import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { BattleMode, BattleResult, CurrencyType, Prisma, TransactionType } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';

type GatewayUser = {
  id: string;
  email: string;
  username: string;
  rating: number;
};

type QueueEntry = {
  socketId: string;
  userId: string;
  username: string;
  rating: number;
  teamId: string;
  joinedAt: number;
};

type JwtPayload = {
  sub: string;
  email: string;
};

type CombatMove = {
  slug: string;
  name: string;
  type: string;
  power: number;
  accuracy: number;
};

type Combatant = {
  name: string;
  slug: string;
  level: number;
  primaryType: string;
  secondaryType: string | null;
  maxHp: number;
  currentHp: number;
  attack: number;
  defense: number;
  speed: number;
  moves: CombatMove[];
};

type MatchParticipant = {
  socketId: string;
  userId: string;
  username: string;
  rating: number;
  teamId: string;
  isConnected: boolean;
  combatants: Combatant[];
  activeIndex: number;
  mustSwitch: boolean;
  result: BattleResult | null;
  rewards: { coins: number; xp: number } | null;
  ratingDelta: number | null;
};

type PvpMatch = {
  id: string;
  mode: 'RANKED';
  createdAt: number;
  turn: number;
  turnSide: 'A' | 'B';
  status: 'IN_PROGRESS' | 'FINISHED';
  winner: 'A' | 'B' | 'DRAW' | null;
  participantA: MatchParticipant;
  participantB: MatchParticipant;
  log: string[];
};

const TEAM_WITH_MOVES_SELECT = {
  id: true,
  name: true,
  slots: {
    orderBy: [{ slot: 'asc' }],
    select: {
      userCreature: {
        select: {
          level: true,
          species: {
            select: {
              slug: true,
              name: true,
              primaryType: true,
              secondaryType: true,
              baseHp: true,
              baseAttack: true,
              baseDefense: true,
              baseSpeed: true,
              moves: {
                select: {
                  unlockLevel: true,
                  isDefault: true,
                  move: {
                    select: {
                      id: true,
                      slug: true,
                      name: true,
                      type: true,
                      power: true,
                      accuracy: true,
                    },
                  },
                },
              },
            },
          },
          learnedMoves: {
            select: {
              slot: true,
              move: {
                select: {
                  id: true,
                  slug: true,
                  name: true,
                  type: true,
                  power: true,
                  accuracy: true,
                },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.TeamSelect;

@WebSocketGateway({
  namespace: 'pvp',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class PvpGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private server!: Server;

  private readonly logger = new Logger(PvpGateway.name);
  private readonly queue: QueueEntry[] = [];
  private readonly connectedUsers = new Map<string, GatewayUser>();
  private readonly matches = new Map<string, PvpMatch>();
  private readonly userToMatch = new Map<string, string>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const user = await this.authenticateSocket(client);
      this.connectedUsers.set(client.id, user);
      client.emit('queue:ready', {
        userId: user.id,
        username: user.username,
        rating: user.rating,
      });
      this.logger.log(`PVP socket connected: ${user.id} (${client.id})`);
    } catch {
      this.logger.warn(`PVP auth failed for socket ${client.id}`);
      client.emit('queue:error', {
        message: 'Unauthorized websocket connection.',
      });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.removeFromQueueBySocket(client.id);

    const user = this.connectedUsers.get(client.id);
    if (user) {
      const matchId = this.userToMatch.get(user.id);
      if (matchId) {
        void this.handleDisconnectForfeit(matchId, user.id);
      }
    }

    this.connectedUsers.delete(client.id);
    this.logger.log(`PVP socket disconnected: ${client.id}`);
  }

  @SubscribeMessage('queue:join')
  async handleQueueJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { teamId?: string } | undefined,
  ) {
    try {
      let user = this.connectedUsers.get(client.id);
      if (!user) {
        user = await this.authenticateSocket(client);
        this.connectedUsers.set(client.id, user);
      }
      if (!user) {
        throw new WsException('Unauthorized.');
      }

      if (this.userToMatch.has(user.id)) {
        throw new WsException('Already in an active match.');
      }

      this.removeFromQueueByUser(user.id);
      const teamId = await this.resolveTeamId(user.id, body?.teamId);
      const entry: QueueEntry = {
        socketId: client.id,
        userId: user.id,
        username: user.username,
        rating: user.rating,
        teamId,
        joinedAt: Date.now(),
      };
      this.queue.push(entry);

      client.emit('queue:joined', {
        teamId,
        joinedAt: entry.joinedAt,
        queueSize: this.queue.length,
      });

      await this.tryMatchmake();
      return {
        ok: true,
        queueSize: this.queue.length,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not join queue.';
      client.emit('queue:error', { message });
      return {
        ok: false,
        message,
        queueSize: this.queue.length,
      };
    }
  }

  @SubscribeMessage('queue:leave')
  handleQueueLeave(@ConnectedSocket() client: Socket) {
    const user = this.connectedUsers.get(client.id);
    if (!user) {
      return { ok: true, queueSize: this.queue.length };
    }

    this.removeFromQueueByUser(user.id);
    client.emit('queue:left', {
      queueSize: this.queue.length,
    });

    return {
      ok: true,
      queueSize: this.queue.length,
    };
  }

  @SubscribeMessage('queue:status')
  handleQueueStatus(@ConnectedSocket() client: Socket) {
    const user = this.connectedUsers.get(client.id);
    if (!user) {
      throw new WsException('Unauthorized.');
    }

    const entry = this.queue.find((item) => item.userId === user.id);
    return {
      inQueue: !!entry,
      joinedAt: entry?.joinedAt ?? null,
      teamId: entry?.teamId ?? null,
      queueSize: this.queue.length,
      matchId: this.userToMatch.get(user.id) ?? null,
    };
  }

  @SubscribeMessage('match:join')
  handleMatchJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { matchId?: string } | undefined,
  ) {
    const user = this.connectedUsers.get(client.id);
    if (!user) {
      throw new WsException('Unauthorized.');
    }

    const matchId = body?.matchId ?? this.userToMatch.get(user.id);
    if (!matchId) {
      throw new WsException('matchId is required.');
    }

    const match = this.matches.get(matchId);
    if (!match) {
      throw new WsException('Match not found.');
    }

    const side = this.sideForUser(match, user.id);
    if (!side) {
      throw new WsException('You are not part of this match.');
    }

    const state = this.buildPlayerView(match, side);
    client.emit('match:state', state);
    return { ok: true };
  }

  @SubscribeMessage('battle:action')
  async handleBattleAction(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    body:
      | {
          matchId?: string;
          action?: 'MOVE' | 'SWITCH';
          moveIndex?: number;
          switchIndex?: number;
        }
      | undefined,
  ) {
    try {
      const user = this.connectedUsers.get(client.id);
      if (!user) {
        throw new WsException('Unauthorized.');
      }

      const matchId = body?.matchId ?? this.userToMatch.get(user.id);
      if (!matchId) {
        throw new WsException('matchId is required.');
      }
      const action = body?.action;
      if (action !== 'MOVE' && action !== 'SWITCH') {
        throw new WsException('action must be MOVE or SWITCH.');
      }

      const match = this.matches.get(matchId);
      if (!match) {
        throw new WsException('Match not found.');
      }
      if (match.status === 'FINISHED') {
        throw new WsException('Match already finished.');
      }

      const side = this.sideForUser(match, user.id);
      if (!side) {
        throw new WsException('You are not part of this match.');
      }
      if (match.turnSide !== side) {
        throw new WsException('Not your turn.');
      }

      const actor = side === 'A' ? match.participantA : match.participantB;
      const target = side === 'A' ? match.participantB : match.participantA;

      if (actor.mustSwitch && action !== 'SWITCH') {
        throw new WsException('You must switch before attacking.');
      }

      if (action === 'SWITCH') {
        const switchIndex = body?.switchIndex;
        if (switchIndex === undefined || switchIndex === null) {
          throw new WsException('switchIndex is required for SWITCH action.');
        }
        if (switchIndex < 0 || switchIndex >= actor.combatants.length) {
          throw new WsException('Invalid switch index.');
        }

        const incoming = actor.combatants[switchIndex];
        if (!incoming || incoming.currentHp <= 0) {
          throw new WsException('Selected creature cannot battle.');
        }
        if (!actor.mustSwitch && switchIndex === actor.activeIndex) {
          throw new WsException('Selected creature is already active.');
        }

        actor.activeIndex = switchIndex;
        actor.mustSwitch = false;
        match.log.push(`${actor.username} sent out ${incoming.name}.`);

        const targetHasLiving = this.firstLivingIndex(target.combatants) >= 0;
        if (!targetHasLiving) {
          match.status = 'FINISHED';
          match.winner = side;
        } else {
          match.turnSide = target.mustSwitch ? (side === 'A' ? 'B' : 'A') : (side === 'A' ? 'B' : 'A');
          if (target.mustSwitch) {
            match.log.push(`${target.username} must switch.`);
          } else {
            match.turn += 1;
          }
        }
      } else {
        const moveIndex = body?.moveIndex;
        const activeActor = actor.combatants[actor.activeIndex];
        const activeTarget = target.combatants[target.activeIndex];

        if (!activeActor || activeActor.currentHp <= 0) {
          throw new WsException('No active creature available.');
        }
        if (!activeTarget || activeTarget.currentHp <= 0) {
          throw new WsException('Opponent has no active creature.');
        }
        if (moveIndex === undefined || moveIndex === null) {
          throw new WsException('moveIndex is required for MOVE action.');
        }
        if (moveIndex < 0 || moveIndex >= activeActor.moves.length) {
          throw new WsException('Invalid move index.');
        }

        const move = activeActor.moves[moveIndex];
        const outcome = this.executeAttack(activeActor, activeTarget, move);
        match.log.push(`${activeActor.name} used ${move.name}. ${outcome}`);

        if (activeTarget.currentHp <= 0) {
          match.log.push(`${activeTarget.name} fainted.`);
          const nextTarget = this.firstLivingIndex(target.combatants);
          if (nextTarget < 0) {
            match.status = 'FINISHED';
            match.winner = side;
          } else {
            target.mustSwitch = true;
            match.turnSide = side === 'A' ? 'B' : 'A';
            match.log.push(`${target.username} must switch.`);
          }
        } else {
          match.turnSide = side === 'A' ? 'B' : 'A';
          match.turn += 1;
        }
      }

      if (match.status === 'FINISHED') {
        if (!match.winner) {
          match.winner = this.resolveWinner(match);
        }
        await this.finalizeMatch(match);
      }

      this.emitState(match);
      if (match.status === 'FINISHED') {
        this.userToMatch.delete(match.participantA.userId);
        this.userToMatch.delete(match.participantB.userId);
        this.matches.delete(match.id);
      }
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Action failed.';
      client.emit('battle:error', { message });
      return { ok: false, message };
    }
  }

  private async resolveTeamId(userId: string, requestedTeamId?: string): Promise<string> {
    const where = requestedTeamId ? { id: requestedTeamId, userId } : { userId, isDefault: true };

    let team = await this.prisma.team.findFirst({
      where,
      select: {
        id: true,
        _count: {
          select: {
            slots: true,
          },
        },
      },
      orderBy: requestedTeamId ? undefined : [{ createdAt: 'asc' }],
    });

    if (!team && !requestedTeamId) {
      team = await this.prisma.team.findFirst({
        where: { userId },
        select: {
          id: true,
          _count: {
            select: {
              slots: true,
            },
          },
        },
        orderBy: [{ createdAt: 'asc' }],
      });
    }

    if (!team) {
      throw new WsException('Team not found.');
    }
    if (team._count.slots === 0) {
      throw new WsException('Selected team has no creatures.');
    }

    return team.id;
  }

  private removeFromQueueBySocket(socketId: string): void {
    const index = this.queue.findIndex((entry) => entry.socketId === socketId);
    if (index >= 0) {
      this.queue.splice(index, 1);
    }
  }

  private removeFromQueueByUser(userId: string): void {
    const next = this.queue.filter((entry) => entry.userId !== userId);
    this.queue.splice(0, this.queue.length, ...next);
  }

  private async tryMatchmake(): Promise<void> {
    if (this.queue.length < 2) {
      return;
    }

    const sorted = [...this.queue].sort((a, b) => a.joinedAt - b.joinedAt);
    const matchedIds = new Set<string>();

    for (let i = 0; i < sorted.length; i += 1) {
      const a = sorted[i];
      if (!a || matchedIds.has(a.userId) || this.userToMatch.has(a.userId)) {
        continue;
      }

      let opponent: QueueEntry | null = null;
      for (let j = i + 1; j < sorted.length; j += 1) {
        const b = sorted[j];
        if (!b || matchedIds.has(b.userId) || b.userId === a.userId || this.userToMatch.has(b.userId)) {
          continue;
        }
        if (this.canMatch(a, b)) {
          opponent = b;
          break;
        }
      }

      if (!opponent) {
        continue;
      }

      matchedIds.add(a.userId);
      matchedIds.add(opponent.userId);
      await this.emitMatchFound(a, opponent);
    }

    if (matchedIds.size > 0) {
      const remaining = this.queue.filter((entry) => !matchedIds.has(entry.userId));
      this.queue.splice(0, this.queue.length, ...remaining);
    }
  }

  private canMatch(a: QueueEntry, b: QueueEntry): boolean {
    const ratingDiff = Math.abs(a.rating - b.rating);
    const tolerance = Math.max(this.dynamicTolerance(a), this.dynamicTolerance(b));
    return ratingDiff <= tolerance;
  }

  private dynamicTolerance(entry: QueueEntry): number {
    const waitedMs = Math.max(0, Date.now() - entry.joinedAt);
    const widenSteps = Math.floor(waitedMs / 30_000);
    return 100 + widenSteps * 40;
  }

  private async emitMatchFound(a: QueueEntry, b: QueueEntry): Promise<void> {
    const matchId = randomUUID();

    const teamA = await this.loadTeamCombatants(a.userId, a.teamId);
    const teamB = await this.loadTeamCombatants(b.userId, b.teamId);

    const match: PvpMatch = {
      id: matchId,
      mode: 'RANKED',
      createdAt: Date.now(),
      turn: 1,
      turnSide: Math.random() < 0.5 ? 'A' : 'B',
      status: 'IN_PROGRESS',
      winner: null,
      participantA: {
        socketId: a.socketId,
        userId: a.userId,
        username: a.username,
        rating: a.rating,
        teamId: a.teamId,
        isConnected: true,
        combatants: teamA,
        activeIndex: 0,
        mustSwitch: false,
        result: null,
        rewards: null,
        ratingDelta: null,
      },
      participantB: {
        socketId: b.socketId,
        userId: b.userId,
        username: b.username,
        rating: b.rating,
        teamId: b.teamId,
        isConnected: true,
        combatants: teamB,
        activeIndex: 0,
        mustSwitch: false,
        result: null,
        rewards: null,
        ratingDelta: null,
      },
      log: [
        `${a.username} sent out ${teamA[0]?.name ?? 'Unknown'}!`,
        `${b.username} sent out ${teamB[0]?.name ?? 'Unknown'}!`,
      ],
    };

    this.matches.set(matchId, match);
    this.userToMatch.set(a.userId, matchId);
    this.userToMatch.set(b.userId, matchId);

    const payloadA = {
      matchId,
      mode: 'RANKED',
      teamId: a.teamId,
      opponent: {
        userId: b.userId,
        username: b.username,
        rating: b.rating,
      },
      matchedAt: new Date().toISOString(),
    };
    const payloadB = {
      matchId,
      mode: 'RANKED',
      teamId: b.teamId,
      opponent: {
        userId: a.userId,
        username: a.username,
        rating: a.rating,
      },
      matchedAt: new Date().toISOString(),
    };

    this.server.to(a.socketId).emit('match:found', payloadA);
    this.server.to(b.socketId).emit('match:found', payloadB);

    this.emitState(match);
  }

  private async loadTeamCombatants(userId: string, teamId: string): Promise<Combatant[]> {
    const team = await this.prisma.team.findFirst({
      where: {
        id: teamId,
        userId,
      },
      select: TEAM_WITH_MOVES_SELECT,
    });

    if (!team || team.slots.length === 0) {
      throw new WsException('Team not found or empty.');
    }

    return team.slots.map((slot) => {
      const creature = slot.userCreature;
      const species = creature.species;
      const learnedMoves = creature.learnedMoves
        .sort((x, y) => x.slot - y.slot)
        .slice(0, 4)
        .map((entry) => this.toCombatMove(entry.move.slug, entry.move.name, entry.move.type, entry.move.power, entry.move.accuracy));

      const speciesMoves = species.moves
        .filter((entry) => entry.isDefault || entry.unlockLevel <= creature.level)
        .sort((x, y) => x.unlockLevel - y.unlockLevel)
        .slice(0, 4)
        .map((entry) => this.toCombatMove(entry.move.slug, entry.move.name, entry.move.type, entry.move.power, entry.move.accuracy));

      const moves = learnedMoves.length > 0 ? learnedMoves : speciesMoves.length > 0 ? speciesMoves : [
        this.toCombatMove('struggle', 'Struggle', 'normal', 40, 100),
      ];

      const maxHp = this.calculateHp(species.baseHp, creature.level);
      return {
        name: species.name,
        slug: species.slug,
        level: creature.level,
        primaryType: species.primaryType.toLowerCase(),
        secondaryType: species.secondaryType ? species.secondaryType.toLowerCase() : null,
        maxHp,
        currentHp: maxHp,
        attack: this.calculateStat(species.baseAttack, creature.level),
        defense: this.calculateStat(species.baseDefense, creature.level),
        speed: this.calculateStat(species.baseSpeed, creature.level),
        moves,
      };
    });
  }

  private toCombatMove(
    slug: string,
    name: string,
    type: string | null,
    power: number | null,
    accuracy: number | null,
  ): CombatMove {
    return {
      slug,
      name,
      type: (type ?? 'normal').toLowerCase(),
      power: Math.max(1, power ?? 40),
      accuracy: Math.min(100, Math.max(1, accuracy ?? 100)),
    };
  }

  private executeAttack(attacker: Combatant, target: Combatant, move: CombatMove): string {
    const hitRoll = Math.random() * 100;
    if (hitRoll > move.accuracy) {
      return 'It missed.';
    }

    const stab = move.type === attacker.primaryType || move.type === attacker.secondaryType ? 1.2 : 1;
    const randomFactor = this.randomFloat(0.85, 1);
    const base =
      (((2 * attacker.level) / 5 + 2) * move.power * (attacker.attack / Math.max(1, target.defense))) / 50 +
      2;
    const damage = Math.max(1, Math.floor(base * stab * randomFactor));

    target.currentHp = Math.max(0, target.currentHp - damage);
    return `It dealt ${damage} damage.`;
  }

  private calculateHp(base: number, level: number): number {
    return Math.floor((2 * base * level) / 100) + level + 10;
  }

  private calculateStat(base: number, level: number): number {
    return Math.floor((2 * base * level) / 100) + 5;
  }

  private randomFloat(min: number, max: number): number {
    return Math.random() * (max - min) + min;
  }

  private firstLivingIndex(combatants: Combatant[]): number {
    return combatants.findIndex((combatant) => combatant.currentHp > 0);
  }

  private resolveWinner(match: PvpMatch): 'A' | 'B' | 'DRAW' {
    const hpA = match.participantA.combatants.reduce((sum, c) => sum + c.currentHp, 0);
    const hpB = match.participantB.combatants.reduce((sum, c) => sum + c.currentHp, 0);
    if (hpA > hpB) {
      return 'A';
    }
    if (hpB > hpA) {
      return 'B';
    }
    return 'DRAW';
  }

  private async finalizeMatch(match: PvpMatch): Promise<void> {
    const winner = match.winner ?? this.resolveWinner(match);
    const resultA = winner === 'A' ? BattleResult.WIN : winner === 'B' ? BattleResult.LOSS : BattleResult.DRAW;
    const resultB = winner === 'B' ? BattleResult.WIN : winner === 'A' ? BattleResult.LOSS : BattleResult.DRAW;

    await this.prisma.$transaction(async (tx) => {
      const [userA, userB] = await Promise.all([
        tx.user.findUniqueOrThrow({ where: { id: match.participantA.userId }, select: { rating: true, level: true, xp: true } }),
        tx.user.findUniqueOrThrow({ where: { id: match.participantB.userId }, select: { rating: true, level: true, xp: true } }),
      ]);

      const actualA = resultA === BattleResult.WIN ? 1 : resultA === BattleResult.DRAW ? 0.5 : 0;
      const expectedA = 1 / (1 + 10 ** ((userB.rating - userA.rating) / 400));
      const ratingDeltaA = Math.round(28 * (actualA - expectedA));
      const ratingDeltaB = -ratingDeltaA;

      const reward = (result: BattleResult) => ({
        coins: result === BattleResult.WIN ? 180 : result === BattleResult.DRAW ? 95 : 55,
        xp: result === BattleResult.WIN ? 130 : result === BattleResult.DRAW ? 80 : 45,
      });

      const rewardA = reward(resultA);
      const rewardB = reward(resultB);

      const nextA = {
        rating: Math.max(0, userA.rating + ratingDeltaA),
        xpTotal: userA.xp + rewardA.xp,
      };
      const nextB = {
        rating: Math.max(0, userB.rating + ratingDeltaB),
        xpTotal: userB.xp + rewardB.xp,
      };

      const levelGainA = Math.floor(nextA.xpTotal / 1000);
      const levelGainB = Math.floor(nextB.xpTotal / 1000);

      await tx.user.update({
        where: { id: match.participantA.userId },
        data: {
          rating: nextA.rating,
          coins: { increment: rewardA.coins },
          xp: nextA.xpTotal % 1000,
          level: userA.level + levelGainA,
        },
      });

      await tx.user.update({
        where: { id: match.participantB.userId },
        data: {
          rating: nextB.rating,
          coins: { increment: rewardB.coins },
          xp: nextB.xpTotal % 1000,
          level: userB.level + levelGainB,
        },
      });

      const createdBattle = await tx.battle.create({
        data: {
          mode: BattleMode.RANKED,
          playerAId: match.participantA.userId,
          playerBId: match.participantB.userId,
          playerATeamId: match.participantA.teamId,
          playerBTeamId: match.participantB.teamId,
          winnerUserId:
            winner === 'A' ? match.participantA.userId : winner === 'B' ? match.participantB.userId : null,
          resultForA: resultA,
          resultForB: resultB,
          playerARatingBefore: userA.rating,
          playerARatingAfter: nextA.rating,
          playerBRatingBefore: userB.rating,
          playerBRatingAfter: nextB.rating,
          coinsAwardedA: rewardA.coins,
          coinsAwardedB: rewardB.coins,
          battleLogJson: {
            mode: 'PVP',
            turns: match.turn,
            log: match.log,
          },
          finishedAt: new Date(),
        },
      });

      await tx.currencyTransaction.createMany({
        data: [
          {
            userId: match.participantA.userId,
            currencyType: CurrencyType.COINS,
            amount: rewardA.coins,
            transactionType: TransactionType.BATTLE_REWARD,
            referenceId: createdBattle.id,
            metadata: { mode: 'PVP', result: resultA, ratingDelta: ratingDeltaA },
          },
          {
            userId: match.participantB.userId,
            currencyType: CurrencyType.COINS,
            amount: rewardB.coins,
            transactionType: TransactionType.BATTLE_REWARD,
            referenceId: createdBattle.id,
            metadata: { mode: 'PVP', result: resultB, ratingDelta: ratingDeltaB },
          },
        ],
      });

      match.participantA.result = resultA;
      match.participantB.result = resultB;
      match.participantA.rewards = rewardA;
      match.participantB.rewards = rewardB;
      match.participantA.ratingDelta = ratingDeltaA;
      match.participantB.ratingDelta = ratingDeltaB;
    });

    match.status = 'FINISHED';
  }

  private sideForUser(match: PvpMatch, userId: string): 'A' | 'B' | null {
    if (match.participantA.userId === userId) {
      return 'A';
    }
    if (match.participantB.userId === userId) {
      return 'B';
    }
    return null;
  }

  private emitState(match: PvpMatch): void {
    this.server.to(match.participantA.socketId).emit('match:state', this.buildPlayerView(match, 'A'));
    this.server.to(match.participantB.socketId).emit('match:state', this.buildPlayerView(match, 'B'));
  }

  private buildPlayerView(match: PvpMatch, side: 'A' | 'B') {
    const player = side === 'A' ? match.participantA : match.participantB;
    const opponent = side === 'A' ? match.participantB : match.participantA;

    const activePlayer = player.combatants[player.activeIndex] ?? null;
    const activeOpponent = opponent.combatants[opponent.activeIndex] ?? null;

    const winnerSide =
      match.winner === null ? null : match.winner === side ? 'A' : match.winner === 'DRAW' ? 'DRAW' : 'B';

    return {
      matchId: match.id,
      battleId: match.id,
      mode: 'LIVE',
      queue: 'RANKED',
      status: match.status,
      turn: match.turn,
      finished: match.status === 'FINISHED',
      mustPlayerSwitch: player.mustSwitch,
      winnerSide,
      result: player.result,
      rewards: player.rewards,
      ratingDelta: player.ratingDelta,
      canAct: match.status === 'IN_PROGRESS' && match.turnSide === side,
      awaiting: match.turnSide === side ? 'YOU' : 'OPPONENT',
      opponentConnected: opponent.isConnected,
      player: activePlayer
        ? {
            name: activePlayer.name,
            slug: activePlayer.slug,
            hp: activePlayer.currentHp,
            maxHp: activePlayer.maxHp,
            hpPercent: Math.max(0, Math.round((activePlayer.currentHp / Math.max(1, activePlayer.maxHp)) * 100)),
            statusCondition: null,
            moves: activePlayer.moves,
            teamRemaining: player.combatants.filter((c) => c.currentHp > 0).length,
          }
        : null,
      playerRoster: player.combatants.map((combatant, index) => ({
        index,
        name: combatant.name,
        slug: combatant.slug,
        hp: combatant.currentHp,
        maxHp: combatant.maxHp,
        statusCondition: null,
        isActive: index === player.activeIndex,
        isFainted: combatant.currentHp <= 0,
        canSwitch: combatant.currentHp > 0 && (!player.mustSwitch ? index !== player.activeIndex : true),
      })),
      opponent: activeOpponent
        ? {
            name: activeOpponent.name,
            slug: activeOpponent.slug,
            hp: activeOpponent.currentHp,
            maxHp: activeOpponent.maxHp,
            hpPercent: Math.max(0, Math.round((activeOpponent.currentHp / Math.max(1, activeOpponent.maxHp)) * 100)),
            statusCondition: null,
            teamRemaining: opponent.combatants.filter((c) => c.currentHp > 0).length,
          }
        : null,
      latestMessage: match.log[match.log.length - 1] ?? null,
      log: match.log.slice(-220),
    };
  }

  private async handleDisconnectForfeit(matchId: string, disconnectedUserId: string): Promise<void> {
    const match = this.matches.get(matchId);
    if (!match || match.status === 'FINISHED') {
      return;
    }

    const side = this.sideForUser(match, disconnectedUserId);
    if (!side) {
      return;
    }
    if (side === 'A') {
      match.participantA.isConnected = false;
    } else {
      match.participantB.isConnected = false;
    }

    match.status = 'FINISHED';
    match.winner = side === 'A' ? 'B' : 'A';
    match.log.push(`${side === 'A' ? match.participantA.username : match.participantB.username} disconnected. Forfeit.`);
    await this.finalizeMatch(match);
    this.emitState(match);

    this.userToMatch.delete(match.participantA.userId);
    this.userToMatch.delete(match.participantB.userId);
    this.matches.delete(match.id);
  }

  private extractToken(client: Socket): string | null {
    const auth = client.handshake.auth as Record<string, unknown> | undefined;
    const authTokenRaw = auth?.['token'];
    const authToken = typeof authTokenRaw === 'string' ? authTokenRaw : null;
    if (authToken) {
      return authToken.startsWith('Bearer ') ? authToken.slice(7) : authToken;
    }

    const header = client.handshake.headers['authorization'];
    if (typeof header !== 'string') {
      return null;
    }
    return header.startsWith('Bearer ') ? header.slice(7) : header;
  }

  private async authenticateSocket(client: Socket): Promise<GatewayUser> {
    const token = this.extractToken(client);
    if (!token) {
      throw new WsException('Missing auth token.');
    }

    const payload = this.jwtService.verify<JwtPayload>(token, {
      secret: this.configService.get<string>('JWT_SECRET', 'dev-change-me'),
    });

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        username: true,
        rating: true,
      },
    });
    if (!user) {
      throw new WsException('User not found.');
    }

    return user;
  }
}
