import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BattleMode, BattleResult, CurrencyType, Prisma, TransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type CombatMove = {
  slug: string;
  name: string;
  type: string;
  power: number | null;
  accuracy: number;
};

type StatusCondition = 'BURN' | 'POISON';

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
  attackStage: number;
  defenseStage: number;
  speedStage: number;
  statusCondition: StatusCondition | null;
  moves: CombatMove[];
};

type CombatTeam = {
  name: string;
  combatants: Combatant[];
};

type SimulationResult = {
  winner: 'A' | 'B' | 'DRAW';
  turns: number;
  log: string[];
  remainingHpA: number;
  remainingHpB: number;
  ended: boolean;
};

type LiveBattleState = {
  status: 'IN_PROGRESS' | 'FINISHED';
  queue: 'AI' | 'RANKED';
  mustPlayerSwitch: boolean;
  turn: number;
  log: string[];
  playerTeamName: string;
  opponentTeamName: string;
  playerTeam: Combatant[];
  opponentTeam: Combatant[];
  activePlayerIndex: number;
  activeOpponentIndex: number;
  winner: 'A' | 'B' | 'DRAW' | null;
  opponentRating?: number;
  rewards?: {
    coins: number;
    xp: number;
  };
  ratingDelta?: number;
  result?: BattleResult;
};

const MOVE_SELECT = {
  slug: true,
  name: true,
  type: true,
  power: true,
  accuracy: true,
} satisfies Prisma.MoveSelect;

const TEAM_SELECT = {
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
                    select: MOVE_SELECT,
                  },
                },
              },
            },
          },
          learnedMoves: {
            select: {
              slot: true,
              move: {
                select: MOVE_SELECT,
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.TeamSelect;

type TeamData = Prisma.TeamGetPayload<{ select: typeof TEAM_SELECT }>;
type TeamSlotData = TeamData['slots'][number];
type SpeciesMoveData = TeamSlotData['userCreature']['species']['moves'][number];
type LearnedMoveData = TeamSlotData['userCreature']['learnedMoves'][number];

const OPPONENT_SPECIES_SELECT = {
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
        select: MOVE_SELECT,
      },
    },
  },
} satisfies Prisma.CreatureSpeciesSelect;

const TYPE_CHART: Record<string, { strong: string[]; weak: string[]; immune?: string[] }> = {
  normal: { strong: [], weak: ['rock', 'steel'], immune: ['ghost'] },
  fire: { strong: ['grass', 'ice', 'bug', 'steel'], weak: ['fire', 'water', 'rock', 'dragon'] },
  water: { strong: ['fire', 'ground', 'rock'], weak: ['water', 'grass', 'dragon'] },
  electric: {
    strong: ['water', 'flying'],
    weak: ['electric', 'grass', 'dragon'],
    immune: ['ground'],
  },
  grass: {
    strong: ['water', 'ground', 'rock'],
    weak: ['fire', 'grass', 'poison', 'flying', 'bug', 'dragon', 'steel'],
  },
  ice: { strong: ['grass', 'ground', 'flying', 'dragon'], weak: ['fire', 'water', 'ice', 'steel'] },
  fighting: {
    strong: ['normal', 'ice', 'rock', 'dark', 'steel'],
    weak: ['poison', 'flying', 'psychic', 'bug', 'fairy'],
    immune: ['ghost'],
  },
  poison: {
    strong: ['grass', 'fairy'],
    weak: ['poison', 'ground', 'rock', 'ghost'],
    immune: ['steel'],
  },
  ground: {
    strong: ['fire', 'electric', 'poison', 'rock', 'steel'],
    weak: ['grass', 'bug'],
    immune: ['flying'],
  },
  flying: { strong: ['grass', 'fighting', 'bug'], weak: ['electric', 'rock', 'steel'] },
  psychic: { strong: ['fighting', 'poison'], weak: ['psychic', 'steel'], immune: ['dark'] },
  bug: {
    strong: ['grass', 'psychic', 'dark'],
    weak: ['fire', 'fighting', 'poison', 'flying', 'ghost', 'steel', 'fairy'],
  },
  rock: { strong: ['fire', 'ice', 'flying', 'bug'], weak: ['fighting', 'ground', 'steel'] },
  ghost: { strong: ['psychic', 'ghost'], weak: ['dark'], immune: ['normal'] },
  dragon: { strong: ['dragon'], weak: ['steel'], immune: ['fairy'] },
  dark: { strong: ['psychic', 'ghost'], weak: ['fighting', 'dark', 'fairy'] },
  steel: { strong: ['ice', 'rock', 'fairy'], weak: ['fire', 'water', 'electric', 'steel'] },
  fairy: { strong: ['fighting', 'dragon', 'dark'], weak: ['fire', 'poison', 'steel'] },
};

@Injectable()
export class BattlesService {
  constructor(private readonly prisma: PrismaService) {}

  async runAiBattle(userId: string, requestedTeamId?: string) {
    const playerTeamData = await this.resolveTeam(userId, requestedTeamId);
    if (playerTeamData.slots.length === 0) {
      throw new BadRequestException('Selected team has no creatures.');
    }

    const playerTeam = this.toCombatTeam(playerTeamData.name, playerTeamData.slots);
    const averageLevel = this.averageLevel(playerTeam.combatants);
    const opponentTeam = await this.generateOpponentTeam(
      playerTeam.combatants.length,
      averageLevel,
      'AI Trainer',
    );

    const simulation = this.simulateBattle(playerTeam, opponentTeam);
    const result = this.winnerToResult(simulation.winner);

    const coinsAwarded = result === BattleResult.WIN ? 130 : result === BattleResult.DRAW ? 70 : 40;
    const xpAwarded = result === BattleResult.WIN ? 90 : result === BattleResult.DRAW ? 55 : 30;
    const ratingDelta = result === BattleResult.WIN ? 18 : result === BattleResult.DRAW ? 0 : -12;

    const battle = await this.prisma.$transaction(async (tx) => {
      const before = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { rating: true, xp: true, level: true },
      });

      const xpAfter = before.xp + xpAwarded;
      const levelGain = Math.floor(xpAfter / 1000);
      const normalizedXp = xpAfter % 1000;
      const levelAfter = before.level + levelGain;
      const ratingAfter = Math.max(0, before.rating + ratingDelta);

      await tx.user.update({
        where: { id: userId },
        data: {
          coins: { increment: coinsAwarded },
          xp: normalizedXp,
          level: levelAfter,
          rating: ratingAfter,
        },
      });

      const createdBattle = await tx.battle.create({
        data: {
          mode: BattleMode.AI,
          playerAId: userId,
          playerATeamId: playerTeamData.id,
          resultForA: result,
          playerARatingBefore: before.rating,
          playerARatingAfter: ratingAfter,
          coinsAwardedA: coinsAwarded,
          battleLogJson: {
            simulation: true,
            engine: 'turn-based-moves',
            turns: simulation.turns,
            remainingHpA: simulation.remainingHpA,
            remainingHpB: simulation.remainingHpB,
            log: simulation.log,
          },
          finishedAt: new Date(),
        },
      });

      await tx.currencyTransaction.create({
        data: {
          userId,
          currencyType: CurrencyType.COINS,
          amount: coinsAwarded,
          transactionType: TransactionType.BATTLE_REWARD,
          referenceId: createdBattle.id,
          metadata: {
            mode: 'AI',
            result,
          },
        },
      });

      return createdBattle;
    });

    return {
      battleId: battle.id,
      result,
      rewards: {
        coins: coinsAwarded,
        xp: xpAwarded,
      },
      ratingDelta,
      team: {
        id: playerTeamData.id,
        name: playerTeamData.name,
        power: this.computeTeamPower(playerTeam.combatants),
      },
      opponent: {
        name: opponentTeam.name,
        power: this.computeTeamPower(opponentTeam.combatants),
      },
      participants: {
        player: {
          name: playerTeam.combatants[0]?.name ?? 'Unknown',
          slug: playerTeam.combatants[0]?.slug ?? null,
        },
        opponent: {
          name: opponentTeam.combatants[0]?.name ?? 'Unknown',
          slug: opponentTeam.combatants[0]?.slug ?? null,
        },
      },
      gameEnded: simulation.ended,
      winnerSide: simulation.winner,
      turns: simulation.turns,
      battleLog: simulation.log,
      createdAt: battle.createdAt,
    };
  }

  async runRankedBattle(userId: string, requestedTeamId?: string) {
    const playerTeamData = await this.resolveTeam(userId, requestedTeamId);
    if (playerTeamData.slots.length === 0) {
      throw new BadRequestException('Selected team has no creatures.');
    }

    const playerTeam = this.toCombatTeam(playerTeamData.name, playerTeamData.slots);

    const battle = await this.prisma.$transaction(async (tx) => {
      const before = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { rating: true, xp: true, level: true },
      });

      const levelTarget = this.levelFromRating(before.rating);
      const opponentTeam = await this.generateOpponentTeam(
        playerTeam.combatants.length,
        levelTarget,
        'Ranked Opponent',
      );

      const simulation = this.simulateBattle(playerTeam, opponentTeam);
      const result = this.winnerToResult(simulation.winner);

      const opponentRating = Math.max(100, before.rating + Math.round(this.randomFloat(-120, 120)));
      const actual = result === BattleResult.WIN ? 1 : result === BattleResult.DRAW ? 0.5 : 0;
      const expected = 1 / (1 + 10 ** ((opponentRating - before.rating) / 400));
      const ratingDelta = Math.round(28 * (actual - expected));

      const coinsAwarded =
        result === BattleResult.WIN ? 180 : result === BattleResult.DRAW ? 95 : 55;
      const xpAwarded = result === BattleResult.WIN ? 130 : result === BattleResult.DRAW ? 80 : 45;

      const xpAfter = before.xp + xpAwarded;
      const levelGain = Math.floor(xpAfter / 1000);
      const normalizedXp = xpAfter % 1000;
      const levelAfter = before.level + levelGain;
      const ratingAfter = Math.max(0, before.rating + ratingDelta);

      await tx.user.update({
        where: { id: userId },
        data: {
          coins: { increment: coinsAwarded },
          xp: normalizedXp,
          level: levelAfter,
          rating: ratingAfter,
        },
      });

      const createdBattle = await tx.battle.create({
        data: {
          mode: BattleMode.RANKED,
          playerAId: userId,
          playerATeamId: playerTeamData.id,
          resultForA: result,
          playerARatingBefore: before.rating,
          playerARatingAfter: ratingAfter,
          playerBRatingBefore: opponentRating,
          playerBRatingAfter: opponentRating,
          coinsAwardedA: coinsAwarded,
          battleLogJson: {
            simulation: true,
            queue: 'ranked',
            engine: 'turn-based-moves',
            expectedScore: expected,
            turns: simulation.turns,
            remainingHpA: simulation.remainingHpA,
            remainingHpB: simulation.remainingHpB,
            log: simulation.log,
          },
          finishedAt: new Date(),
        },
      });

      await tx.currencyTransaction.create({
        data: {
          userId,
          currencyType: CurrencyType.COINS,
          amount: coinsAwarded,
          transactionType: TransactionType.BATTLE_REWARD,
          referenceId: createdBattle.id,
          metadata: {
            mode: 'RANKED',
            result,
            ratingDelta,
          },
        },
      });

      return {
        createdBattle,
        result,
        coinsAwarded,
        xpAwarded,
        ratingDelta,
        opponentRating,
        opponentPower: this.computeTeamPower(opponentTeam.combatants),
        opponentLead: opponentTeam.combatants[0]
          ? { name: opponentTeam.combatants[0].name, slug: opponentTeam.combatants[0].slug }
          : null,
        simulation,
      };
    });

    return {
      battleId: battle.createdBattle.id,
      result: battle.result,
      rewards: {
        coins: battle.coinsAwarded,
        xp: battle.xpAwarded,
      },
      ratingDelta: battle.ratingDelta,
      team: {
        id: playerTeamData.id,
        name: playerTeamData.name,
        power: this.computeTeamPower(playerTeam.combatants),
      },
      opponent: {
        name: 'Ranked Opponent',
        rating: battle.opponentRating,
        power: battle.opponentPower,
      },
      participants: {
        player: {
          name: playerTeam.combatants[0]?.name ?? 'Unknown',
          slug: playerTeam.combatants[0]?.slug ?? null,
        },
        opponent: {
          name: battle.opponentLead?.name ?? 'Ranked Opponent',
          slug: battle.opponentLead?.slug ?? null,
        },
      },
      gameEnded: battle.simulation.ended,
      winnerSide: battle.simulation.winner,
      turns: battle.simulation.turns,
      battleLog: battle.simulation.log,
      createdAt: battle.createdBattle.createdAt,
    };
  }

  async getMyBattleHistory(userId: string) {
    const battles = await this.prisma.battle.findMany({
      where: {
        playerAId: userId,
      },
      include: {
        playerATeam: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 25,
    });

    return {
      total: battles.length,
      battles,
    };
  }

  async startLiveBattle(userId: string, requestedTeamId?: string) {
    return this.startLiveBattleInternal(userId, requestedTeamId, 'AI');
  }

  async startLiveRankedBattle(userId: string, requestedTeamId?: string) {
    return this.startLiveBattleInternal(userId, requestedTeamId, 'RANKED');
  }

  private async startLiveBattleInternal(
    userId: string,
    requestedTeamId: string | undefined,
    queue: 'AI' | 'RANKED',
  ) {
    const playerTeamData = await this.resolveTeam(userId, requestedTeamId);
    if (playerTeamData.slots.length === 0) {
      throw new BadRequestException('Selected team has no creatures.');
    }

    const playerTeam = this.toCombatTeam(playerTeamData.name, playerTeamData.slots);
    let opponentTeam: CombatTeam;
    let opponentRating: number | undefined;

    if (queue === 'RANKED') {
      const profile = await this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { rating: true },
      });
      const levelTarget = this.levelFromRating(profile.rating);
      opponentRating = Math.max(100, profile.rating + Math.round(this.randomFloat(-120, 120)));
      opponentTeam = await this.generateOpponentTeam(
        playerTeam.combatants.length,
        levelTarget,
        'Ranked Opponent',
      );
    } else {
      const averageLevel = this.averageLevel(playerTeam.combatants);
      opponentTeam = await this.generateOpponentTeam(
        playerTeam.combatants.length,
        averageLevel,
        'AI Trainer',
      );
    }

    const state: LiveBattleState = {
      status: 'IN_PROGRESS',
      queue,
      mustPlayerSwitch: false,
      turn: 1,
      log: [
        `Go! ${playerTeam.combatants[0]?.name ?? 'Unknown'}!`,
        `Foe sent out ${opponentTeam.combatants[0]?.name ?? 'Unknown'}!`,
      ],
      playerTeamName: playerTeamData.name,
      opponentTeamName: opponentTeam.name,
      playerTeam: this.cloneCombatants(playerTeam.combatants),
      opponentTeam: this.cloneCombatants(opponentTeam.combatants),
      activePlayerIndex: 0,
      activeOpponentIndex: 0,
      winner: null,
      opponentRating,
    };

    const createdBattle = await this.prisma.battle.create({
      data: {
        mode: queue === 'RANKED' ? BattleMode.RANKED : BattleMode.AI,
        playerAId: userId,
        playerATeamId: playerTeamData.id,
        battleLogJson: state as Prisma.JsonObject,
      },
    });

    return this.toLiveBattleResponse(createdBattle.id, state);
  }

  async getLiveBattle(userId: string, battleId: string) {
    const battle = await this.prisma.battle.findFirst({
      where: {
        id: battleId,
        playerAId: userId,
      },
      select: {
        id: true,
        battleLogJson: true,
      },
    });
    if (!battle) {
      throw new NotFoundException('Live battle not found.');
    }

    const state = this.parseLiveState(battle.battleLogJson);
    return this.toLiveBattleResponse(battle.id, state);
  }

  async playLiveBattleTurn(
    userId: string,
    battleId: string,
    action: 'MOVE' | 'SWITCH',
    moveIndex?: number,
    switchIndex?: number,
  ) {
    const battle = await this.prisma.battle.findFirst({
      where: {
        id: battleId,
        playerAId: userId,
      },
      select: {
        id: true,
        battleLogJson: true,
        playerATeamId: true,
      },
    });
    if (!battle) {
      throw new NotFoundException('Live battle not found.');
    }

    const state = this.parseLiveState(battle.battleLogJson);
    if (state.status === 'FINISHED') {
      return this.toLiveBattleResponse(battle.id, state);
    }

    this.normalizeActiveIndexes(state);
    const playerActive = state.playerTeam[state.activePlayerIndex];
    const opponentActive = state.opponentTeam[state.activeOpponentIndex];

    if (!opponentActive || opponentActive.currentHp <= 0) {
      throw new BadRequestException('No active opponent creature available.');
    }

    if (state.mustPlayerSwitch && action !== 'SWITCH') {
      throw new BadRequestException('You must switch Pokémon before attacking.');
    }

    if (action === 'SWITCH') {
      if (switchIndex === undefined || switchIndex === null) {
        throw new BadRequestException('switchIndex is required for switch action.');
      }
      if (switchIndex < 0 || switchIndex >= state.playerTeam.length) {
        throw new BadRequestException('Invalid switch index.');
      }

      const incoming = state.playerTeam[switchIndex];
      if (!incoming || incoming.currentHp <= 0) {
        throw new BadRequestException('Selected Pokémon cannot battle.');
      }
      if (!state.mustPlayerSwitch && switchIndex === state.activePlayerIndex) {
        throw new BadRequestException('Selected Pokémon is already active.');
      }

      if (state.mustPlayerSwitch) {
        state.activePlayerIndex = switchIndex;
        state.mustPlayerSwitch = false;
        state.log.push(`Go! ${incoming.name}!`);
      } else {
        state.log.push(`Turn ${state.turn}:`);
        state.activePlayerIndex = switchIndex;
        state.log.push(`Come back! Go! ${incoming.name}!`);

        const aiMove = this.pickMove(opponentActive.moves);
        const outcome = this.executeAttack(opponentActive, incoming, aiMove);
        state.log.push(`${opponentActive.name} used ${aiMove.name}. ${outcome}`);

        if (incoming.currentHp <= 0) {
          state.log.push(`${incoming.name} fainted.`);
          state.mustPlayerSwitch = this.firstLivingIndex(state.playerTeam) >= 0;
          if (state.mustPlayerSwitch) {
            state.log.push('Choose your next Pokémon.');
          }
        }

        if (!state.mustPlayerSwitch) {
          state.turn += 1;
        }
      }
    } else {
      if (!playerActive || playerActive.currentHp <= 0) {
        throw new BadRequestException('No active player creature available.');
      }
      if (moveIndex === undefined || moveIndex === null) {
        throw new BadRequestException('moveIndex is required for move action.');
      }
      if (moveIndex < 0 || moveIndex >= playerActive.moves.length) {
        throw new BadRequestException('Invalid move index.');
      }

      const playerMove = playerActive.moves[moveIndex];
      const aiMove = this.pickMove(opponentActive.moves);
      const playerSpeed = this.getEffectiveStat(playerActive, 'speed');
      const opponentSpeed = this.getEffectiveStat(opponentActive, 'speed');
      const firstIsPlayer =
        playerSpeed > opponentSpeed || (playerSpeed === opponentSpeed && Math.random() < 0.5);

      state.log.push(`Turn ${state.turn}:`);
      const order = firstIsPlayer
        ? [
            { actor: playerActive, target: opponentActive, move: playerMove, side: 'A' as const },
            { actor: opponentActive, target: playerActive, move: aiMove, side: 'B' as const },
          ]
        : [
            { actor: opponentActive, target: playerActive, move: aiMove, side: 'B' as const },
            { actor: playerActive, target: opponentActive, move: playerMove, side: 'A' as const },
          ];

      for (const step of order) {
        if (step.actor.currentHp <= 0 || step.target.currentHp <= 0) {
          continue;
        }
        const outcome = this.executeAttack(step.actor, step.target, step.move);
        state.log.push(`${step.actor.name} used ${step.move.name}. ${outcome}`);

        if (step.target.currentHp <= 0) {
          state.log.push(`${step.target.name} fainted.`);
          if (step.side === 'A') {
            const nextOpponent = this.firstLivingIndex(state.opponentTeam);
            state.activeOpponentIndex = nextOpponent;
            if (nextOpponent >= 0) {
              state.log.push(`Foe sent out ${state.opponentTeam[nextOpponent].name}!`);
            }
          } else {
            const nextPlayer = this.firstLivingIndex(state.playerTeam);
            state.mustPlayerSwitch = nextPlayer >= 0;
            if (state.mustPlayerSwitch) {
              state.log.push('Choose your next Pokémon.');
            }
          }
        }
      }

      const livePlayer = state.playerTeam[state.activePlayerIndex];
      const liveOpponent = state.opponentTeam[state.activeOpponentIndex];
      if (livePlayer && livePlayer.currentHp > 0) {
        const tick = this.applyEndTurnStatus(livePlayer);
        if (tick) {
          state.log.push(tick);
          if (livePlayer.currentHp <= 0) {
            state.log.push(`${livePlayer.name} fainted.`);
            const nextPlayer = this.firstLivingIndex(state.playerTeam);
            state.mustPlayerSwitch = nextPlayer >= 0;
            if (state.mustPlayerSwitch) {
              state.log.push('Choose your next Pokémon.');
            }
          }
        }
      }
      if (!state.mustPlayerSwitch && liveOpponent && liveOpponent.currentHp > 0) {
        const tick = this.applyEndTurnStatus(liveOpponent);
        if (tick) {
          state.log.push(tick);
          if (liveOpponent.currentHp <= 0) {
            state.log.push(`${liveOpponent.name} fainted.`);
            const nextOpponent = this.firstLivingIndex(state.opponentTeam);
            state.activeOpponentIndex = nextOpponent;
            if (nextOpponent >= 0) {
              state.log.push(`Foe sent out ${state.opponentTeam[nextOpponent].name}!`);
            }
          }
        }
      }

      if (!state.mustPlayerSwitch) {
        state.turn += 1;
      }
    }

    const remainingHpA = state.playerTeam.reduce((sum, c) => sum + Math.max(0, c.currentHp), 0);
    const remainingHpB = state.opponentTeam.reduce((sum, c) => sum + Math.max(0, c.currentHp), 0);

    if (remainingHpA <= 0 || remainingHpB <= 0) {
      state.status = 'FINISHED';
      state.winner = remainingHpA > remainingHpB ? 'A' : remainingHpB > remainingHpA ? 'B' : 'DRAW';
      state.log.push(`Battle ended: ${state.winner}.`);
      await this.finalizeLiveBattle(userId, battle.id, battle.playerATeamId, state);
      return this.toLiveBattleResponse(battle.id, state);
    }

    if (state.log.length > 220) {
      state.log = state.log.slice(state.log.length - 220);
    }

    await this.prisma.battle.update({
      where: { id: battle.id },
      data: {
        battleLogJson: state as Prisma.JsonObject,
      },
    });

    return this.toLiveBattleResponse(battle.id, state);
  }

  private async resolveTeam(userId: string, requestedTeamId?: string): Promise<TeamData> {
    const where: Prisma.TeamWhereInput = requestedTeamId
      ? { id: requestedTeamId, userId }
      : { userId, isDefault: true };

    let team = await this.prisma.team.findFirst({
      where,
      select: TEAM_SELECT,
      orderBy: requestedTeamId ? undefined : [{ createdAt: 'asc' }],
    });

    if (!team && !requestedTeamId) {
      team = await this.prisma.team.findFirst({
        where: { userId },
        select: TEAM_SELECT,
        orderBy: [{ createdAt: 'asc' }],
      });
    }

    if (!team) {
      throw new NotFoundException(
        requestedTeamId ? 'Team not found.' : 'Create a team before starting battles.',
      );
    }

    return team;
  }

  private async generateOpponentTeam(
    size: number,
    levelTarget: number,
    name: string,
  ): Promise<CombatTeam> {
    const speciesPool = await this.prisma.creatureSpecies.findMany({
      take: 80,
      orderBy: [{ rarity: 'asc' }],
      select: OPPONENT_SPECIES_SELECT,
    });

    if (speciesPool.length === 0) {
      throw new BadRequestException('No species available for opponent generation.');
    }

    const picked: Combatant[] = [];
    const targetSize = Math.max(1, Math.min(6, size));
    for (let i = 0; i < targetSize; i += 1) {
      const species = speciesPool[Math.floor(Math.random() * speciesPool.length)];
      const level = Math.max(1, Math.min(100, Math.round(levelTarget + this.randomFloat(-3, 3))));
      const moves = this.extractMoves([], species.moves, level);
      picked.push(
        this.buildCombatant(
          species.name,
          species.slug,
          level,
          species.primaryType,
          species.secondaryType,
          species.baseHp,
          species.baseAttack,
          species.baseDefense,
          species.baseSpeed,
          moves,
        ),
      );
    }

    return {
      name,
      combatants: picked,
    };
  }

  private toCombatTeam(name: string, slots: TeamSlotData[]): CombatTeam {
    const combatants = slots.map((slot) => {
      const creature = slot.userCreature;
      const species = creature.species;
      const moves = this.extractMoves(creature.learnedMoves, species.moves, creature.level);

      return this.buildCombatant(
        species.name,
        species.slug,
        creature.level,
        species.primaryType,
        species.secondaryType,
        species.baseHp,
        species.baseAttack,
        species.baseDefense,
        species.baseSpeed,
        moves,
      );
    });

    return {
      name,
      combatants,
    };
  }

  private extractMoves(
    learnedMoves: LearnedMoveData[],
    speciesMoves: SpeciesMoveData[],
    level: number,
  ): CombatMove[] {
    if (learnedMoves.length > 0) {
      return learnedMoves
        .sort((a, b) => a.slot - b.slot)
        .slice(0, 4)
        .map((entry) =>
          this.toCombatMove(
            entry.move.slug,
            entry.move.name,
            entry.move.type,
            entry.move.power,
            entry.move.accuracy,
          ),
        );
    }

    const defaults = speciesMoves
      .filter((entry) => entry.isDefault || entry.unlockLevel <= level)
      .sort((a, b) => {
        if (a.isDefault === b.isDefault) {
          return a.unlockLevel - b.unlockLevel;
        }
        return a.isDefault ? -1 : 1;
      })
      .slice(0, 4)
      .map((entry) =>
        this.toCombatMove(
          entry.move.slug,
          entry.move.name,
          entry.move.type,
          entry.move.power,
          entry.move.accuracy,
        ),
      );

    if (defaults.length > 0) {
      return defaults;
    }

    return [this.toCombatMove('struggle', 'Struggle', 'Normal', 40, 100)];
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
      type: (type ?? 'Normal').toLowerCase(),
      power: power === null ? null : Math.max(1, power),
      accuracy: Math.min(100, Math.max(1, accuracy ?? 100)),
    };
  }

  private buildCombatant(
    name: string,
    slug: string,
    level: number,
    primaryType: string,
    secondaryType: string | null,
    baseHp: number,
    baseAttack: number,
    baseDefense: number,
    baseSpeed: number,
    moves: CombatMove[],
  ): Combatant {
    const maxHp = this.calculateHp(baseHp, level);
    return {
      name,
      slug,
      level,
      primaryType: primaryType.toLowerCase(),
      secondaryType: secondaryType ? secondaryType.toLowerCase() : null,
      maxHp,
      currentHp: maxHp,
      attack: this.calculateStat(baseAttack, level),
      defense: this.calculateStat(baseDefense, level),
      speed: this.calculateStat(baseSpeed, level),
      attackStage: 0,
      defenseStage: 0,
      speedStage: 0,
      statusCondition: null,
      moves,
    };
  }

  private simulateBattle(teamA: CombatTeam, teamB: CombatTeam): SimulationResult {
    const log: string[] = [];
    let turns = 0;
    let activeA = -1;
    let activeB = -1;

    while (turns < 80 && this.hasLiving(teamA.combatants) && this.hasLiving(teamB.combatants)) {
      turns += 1;
      const attackerAIndex = this.firstLivingIndex(teamA.combatants);
      const attackerBIndex = this.firstLivingIndex(teamB.combatants);
      if (attackerAIndex < 0 || attackerBIndex < 0) {
        break;
      }

      const attackerA = teamA.combatants[attackerAIndex];
      const attackerB = teamB.combatants[attackerBIndex];

      if (attackerAIndex !== activeA) {
        log.push(`Go! ${attackerA.name}!`);
        activeA = attackerAIndex;
      }
      if (attackerBIndex !== activeB) {
        log.push(`Foe sent out ${attackerB.name}!`);
        activeB = attackerBIndex;
      }

      const moveA = this.pickMove(attackerA.moves);
      const moveB = this.pickMove(attackerB.moves);
      const speedA = this.getEffectiveStat(attackerA, 'speed');
      const speedB = this.getEffectiveStat(attackerB, 'speed');

      const order: Array<{ actor: Combatant; target: Combatant; move: CombatMove }> =
        speedA > speedB
          ? [
              { actor: attackerA, target: attackerB, move: moveA },
              { actor: attackerB, target: attackerA, move: moveB },
            ]
          : speedA < speedB
            ? [
                { actor: attackerB, target: attackerA, move: moveB },
                { actor: attackerA, target: attackerB, move: moveA },
              ]
            : Math.random() < 0.5
              ? [
                  { actor: attackerA, target: attackerB, move: moveA },
                  { actor: attackerB, target: attackerA, move: moveB },
                ]
              : [
                  { actor: attackerB, target: attackerA, move: moveB },
                  { actor: attackerA, target: attackerB, move: moveA },
                ];

      log.push(`Turn ${turns}:`);
      for (const step of order) {
        if (step.actor.currentHp <= 0 || step.target.currentHp <= 0) {
          continue;
        }

        const attackLog = this.executeAttack(step.actor, step.target, step.move);
        log.push(`${step.actor.name} used ${step.move.name}. ${attackLog}`);
        if (step.target.currentHp <= 0) {
          log.push(`${step.target.name} fainted.`);
        }
      }

      const endTurnA = this.applyEndTurnStatus(attackerA);
      if (endTurnA) {
        log.push(endTurnA);
        if (attackerA.currentHp <= 0) {
          log.push(`${attackerA.name} fainted.`);
        }
      }
      const endTurnB = this.applyEndTurnStatus(attackerB);
      if (endTurnB) {
        log.push(endTurnB);
        if (attackerB.currentHp <= 0) {
          log.push(`${attackerB.name} fainted.`);
        }
      }
    }

    const remainingHpA = teamA.combatants.reduce((sum, c) => sum + Math.max(0, c.currentHp), 0);
    const remainingHpB = teamB.combatants.reduce((sum, c) => sum + Math.max(0, c.currentHp), 0);

    let winner: 'A' | 'B' | 'DRAW' = 'DRAW';
    if (remainingHpA > 0 && remainingHpB <= 0) {
      winner = 'A';
    } else if (remainingHpB > 0 && remainingHpA <= 0) {
      winner = 'B';
    } else if (remainingHpA !== remainingHpB) {
      winner = remainingHpA > remainingHpB ? 'A' : 'B';
    }

    return {
      winner,
      turns,
      log: [...log.slice(0, 119), `Battle ended: ${winner}.`],
      remainingHpA,
      remainingHpB,
      ended: true,
    };
  }

  private executeAttack(attacker: Combatant, target: Combatant, move: CombatMove): string {
    const hitRoll = Math.random() * 100;
    if (hitRoll > move.accuracy) {
      return 'It missed.';
    }

    if (move.power === null) {
      return this.executeStatusMove(attacker, target, move);
    }

    const stab =
      move.type === attacker.primaryType || move.type === attacker.secondaryType ? 1.2 : 1;
    const effectiveness = this.typeEffectiveness(move.type, [
      target.primaryType,
      target.secondaryType,
    ]);
    if (effectiveness === 0) {
      return `It had no effect on ${target.name}.`;
    }

    const randomFactor = this.randomFloat(0.85, 1);
    const attackStat = this.getEffectiveStat(attacker, 'attack');
    const defenseStat = this.getEffectiveStat(target, 'defense');
    const base =
      (((2 * attacker.level) / 5 + 2) * move.power * (attackStat / Math.max(1, defenseStat))) / 50 +
      2;
    const damage = Math.max(1, Math.floor(base * stab * effectiveness * randomFactor));

    target.currentHp = Math.max(0, target.currentHp - damage);
    const secondaryStatus = this.applySecondaryStatus(attacker, target, move);

    if (effectiveness >= 2) {
      return `It dealt ${damage} damage. It's super effective.${secondaryStatus ? ` ${secondaryStatus}` : ''}`;
    }
    if (effectiveness < 1) {
      return `It dealt ${damage} damage. It's not very effective.${secondaryStatus ? ` ${secondaryStatus}` : ''}`;
    }

    return `It dealt ${damage} damage.${secondaryStatus ? ` ${secondaryStatus}` : ''}`;
  }

  private executeStatusMove(attacker: Combatant, target: Combatant, move: CombatMove): string {
    const key = (move.slug || move.name).toLowerCase().replace(/\s+/g, '-');
    if (['growl'].includes(key)) {
      return this.applyStageChange(target, 'attack', -1, `${target.name}'s Attack fell.`);
    }
    if (['tail-whip', 'leer'].includes(key)) {
      return this.applyStageChange(target, 'defense', -1, `${target.name}'s Defense fell.`);
    }
    if (['screech'].includes(key)) {
      return this.applyStageChange(target, 'defense', -2, `${target.name}'s Defense sharply fell.`);
    }
    if (['string-shot', 'scary-face'].includes(key)) {
      return this.applyStageChange(target, 'speed', -2, `${target.name}'s Speed harshly fell.`);
    }
    if (['agility'].includes(key)) {
      return this.applyStageChange(attacker, 'speed', 2, `${attacker.name}'s Speed rose sharply.`);
    }
    if (['swords-dance'].includes(key)) {
      return this.applyStageChange(
        attacker,
        'attack',
        2,
        `${attacker.name}'s Attack rose sharply.`,
      );
    }
    if (['harden', 'withdraw', 'defense-curl'].includes(key)) {
      return this.applyStageChange(attacker, 'defense', 1, `${attacker.name}'s Defense rose.`);
    }
    if (['toxic', 'poison-powder'].includes(key)) {
      if (target.statusCondition) {
        return 'But it failed. Target already has a status condition.';
      }
      target.statusCondition = 'POISON';
      return `${target.name} was poisoned.`;
    }
    if (['will-o-wisp'].includes(key)) {
      if (target.statusCondition) {
        return 'But it failed. Target already has a status condition.';
      }
      target.statusCondition = 'BURN';
      return `${target.name} was burned.`;
    }
    return 'But nothing happened.';
  }

  private applySecondaryStatus(
    attacker: Combatant,
    target: Combatant,
    move: CombatMove,
  ): string | null {
    if (target.statusCondition) {
      return null;
    }
    const key = (move.slug || move.name).toLowerCase().replace(/\s+/g, '-');
    const burnChance =
      key === 'fire-blast' ? 0.3 : ['ember', 'flamethrower', 'fire-punch'].includes(key) ? 0.1 : 0;
    if (burnChance > 0 && Math.random() < burnChance) {
      target.statusCondition = 'BURN';
      return `${target.name} was burned.`;
    }

    const poisonChance = ['poison-sting', 'sludge'].includes(key) ? 0.3 : 0;
    if (poisonChance > 0 && Math.random() < poisonChance) {
      target.statusCondition = 'POISON';
      return `${target.name} was poisoned.`;
    }

    const atkDropChance = key === 'bubble-beam' ? 0.1 : 0;
    if (atkDropChance > 0 && Math.random() < atkDropChance) {
      this.modifyStage(target, 'speed', -1);
      return `${target.name}'s Speed fell.`;
    }

    if (key === 'acid' && Math.random() < 0.1) {
      this.modifyStage(target, 'defense', -1);
      return `${target.name}'s Defense fell.`;
    }

    if (key === 'aurora-beam' && Math.random() < 0.1) {
      this.modifyStage(target, 'attack', -1);
      return `${target.name}'s Attack fell.`;
    }

    if (key === 'metal-claw' && Math.random() < 0.1) {
      this.modifyStage(attacker, 'attack', 1);
      return `${attacker.name}'s Attack rose.`;
    }

    return null;
  }

  private applyEndTurnStatus(combatant: Combatant): string | null {
    if (!combatant.statusCondition || combatant.currentHp <= 0) {
      return null;
    }
    const tick = Math.max(1, Math.floor(combatant.maxHp / 8));
    combatant.currentHp = Math.max(0, combatant.currentHp - tick);
    if (combatant.statusCondition === 'BURN') {
      return `${combatant.name} is hurt by its burn (${tick}).`;
    }
    return `${combatant.name} is hurt by poison (${tick}).`;
  }

  private applyStageChange(
    combatant: Combatant,
    stat: 'attack' | 'defense' | 'speed',
    delta: number,
    successMessage: string,
  ): string {
    const changed = this.modifyStage(combatant, stat, delta);
    if (!changed) {
      return 'But it failed.';
    }
    return successMessage;
  }

  private modifyStage(
    combatant: Combatant,
    stat: 'attack' | 'defense' | 'speed',
    delta: number,
  ): boolean {
    const key =
      stat === 'attack' ? 'attackStage' : stat === 'defense' ? 'defenseStage' : 'speedStage';
    const current = combatant[key];
    const next = Math.max(-6, Math.min(6, current + delta));
    if (next === current) {
      return false;
    }
    combatant[key] = next;
    return true;
  }

  private getStageMultiplier(stage: number): number {
    if (stage >= 0) {
      return (2 + stage) / 2;
    }
    return 2 / (2 + Math.abs(stage));
  }

  private getEffectiveStat(combatant: Combatant, stat: 'attack' | 'defense' | 'speed'): number {
    const base =
      stat === 'attack'
        ? combatant.attack
        : stat === 'defense'
          ? combatant.defense
          : combatant.speed;
    const stage =
      stat === 'attack'
        ? combatant.attackStage
        : stat === 'defense'
          ? combatant.defenseStage
          : combatant.speedStage;
    const burnPenalty = stat === 'attack' && combatant.statusCondition === 'BURN' ? 0.75 : 1;
    return Math.max(1, Math.floor(base * this.getStageMultiplier(stage) * burnPenalty));
  }

  private typeEffectiveness(attackType: string, defenderTypes: Array<string | null>): number {
    const chart = TYPE_CHART[attackType] ?? { strong: [], weak: [] };
    let multiplier = 1;

    for (const defenderType of defenderTypes) {
      if (!defenderType) {
        continue;
      }
      if (chart.immune?.includes(defenderType)) {
        return 0;
      }
      if (chart.strong.includes(defenderType)) {
        multiplier *= 2;
      }
      if (chart.weak.includes(defenderType)) {
        multiplier *= 0.5;
      }
    }

    return multiplier;
  }

  private winnerToResult(winner: 'A' | 'B' | 'DRAW'): BattleResult {
    if (winner === 'A') {
      return BattleResult.WIN;
    }
    if (winner === 'B') {
      return BattleResult.LOSS;
    }
    return BattleResult.DRAW;
  }

  private pickMove(moves: CombatMove[]): CombatMove {
    return moves[Math.floor(Math.random() * moves.length)];
  }

  private hasLiving(combatants: Combatant[]): boolean {
    return combatants.some((combatant) => combatant.currentHp > 0);
  }

  private firstLivingIndex(combatants: Combatant[]): number {
    return combatants.findIndex((combatant) => combatant.currentHp > 0);
  }

  private computeTeamPower(combatants: Combatant[]) {
    return combatants.reduce(
      (total, combatant) =>
        total +
        combatant.maxHp +
        combatant.attack +
        combatant.defense +
        combatant.speed +
        combatant.level * 8,
      0,
    );
  }

  private averageLevel(combatants: Combatant[]) {
    if (combatants.length === 0) {
      return 1;
    }
    return Math.round(combatants.reduce((sum, c) => sum + c.level, 0) / combatants.length);
  }

  private levelFromRating(rating: number) {
    return Math.max(1, Math.min(100, Math.round(10 + rating / 60)));
  }

  private calculateHp(base: number, level: number) {
    return Math.floor((2 * base * level) / 100) + level + 10;
  }

  private calculateStat(base: number, level: number) {
    return Math.floor((2 * base * level) / 100) + 5;
  }

  private cloneCombatants(combatants: Combatant[]): Combatant[] {
    return combatants.map((combatant) => ({
      ...combatant,
      moves: combatant.moves.map((move) => ({ ...move })),
    }));
  }

  private parseLiveState(raw: Prisma.JsonValue | null): LiveBattleState {
    if (!raw || typeof raw !== 'object') {
      throw new BadRequestException('Invalid live battle state.');
    }
    const state = raw as unknown as LiveBattleState;
    if (!state.queue) {
      state.queue = 'AI';
    }
    if (state.mustPlayerSwitch === undefined) {
      state.mustPlayerSwitch = false;
    }
    return state;
  }

  private normalizeActiveIndexes(state: LiveBattleState): void {
    if (
      state.activePlayerIndex < 0 ||
      !state.playerTeam[state.activePlayerIndex] ||
      (!state.mustPlayerSwitch && state.playerTeam[state.activePlayerIndex].currentHp <= 0)
    ) {
      state.activePlayerIndex = this.firstLivingIndex(state.playerTeam);
    }

    if (
      state.activeOpponentIndex < 0 ||
      !state.opponentTeam[state.activeOpponentIndex] ||
      state.opponentTeam[state.activeOpponentIndex].currentHp <= 0
    ) {
      state.activeOpponentIndex = this.firstLivingIndex(state.opponentTeam);
    }
  }

  private toLiveBattleResponse(battleId: string, state: LiveBattleState) {
    this.normalizeActiveIndexes(state);

    const player = state.playerTeam[state.activePlayerIndex];
    const opponent = state.opponentTeam[state.activeOpponentIndex];
    const playerRemaining = state.playerTeam.filter((c) => c.currentHp > 0).length;
    const opponentRemaining = state.opponentTeam.filter((c) => c.currentHp > 0).length;

    return {
      battleId,
      mode: 'LIVE',
      queue: state.queue,
      status: state.status,
      turn: state.turn,
      finished: state.status === 'FINISHED',
      mustPlayerSwitch: state.mustPlayerSwitch,
      winnerSide: state.winner,
      result: state.result ?? null,
      rewards: state.rewards ?? null,
      ratingDelta: state.ratingDelta ?? null,
      player: player
        ? {
            name: player.name,
            slug: player.slug,
            hp: player.currentHp,
            maxHp: player.maxHp,
            hpPercent: Math.max(
              0,
              Math.round((player.currentHp / Math.max(1, player.maxHp)) * 100),
            ),
            statusCondition: player.statusCondition,
            moves: player.moves,
            teamRemaining: playerRemaining,
          }
        : null,
      playerRoster: state.playerTeam.map((combatant, index) => ({
        index,
        name: combatant.name,
        slug: combatant.slug,
        hp: combatant.currentHp,
        maxHp: combatant.maxHp,
        statusCondition: combatant.statusCondition,
        isActive: index === state.activePlayerIndex,
        isFainted: combatant.currentHp <= 0,
        canSwitch:
          combatant.currentHp > 0 &&
          (!state.mustPlayerSwitch ? index !== state.activePlayerIndex : true),
      })),
      opponent: opponent
        ? {
            name: opponent.name,
            slug: opponent.slug,
            hp: opponent.currentHp,
            maxHp: opponent.maxHp,
            hpPercent: Math.max(
              0,
              Math.round((opponent.currentHp / Math.max(1, opponent.maxHp)) * 100),
            ),
            statusCondition: opponent.statusCondition,
            teamRemaining: opponentRemaining,
          }
        : null,
      log: state.log,
      latestMessage: state.log[state.log.length - 1] ?? null,
    };
  }

  private async finalizeLiveBattle(
    userId: string,
    battleId: string,
    playerTeamId: string,
    state: LiveBattleState,
  ): Promise<void> {
    const result = this.winnerToResult(state.winner ?? 'DRAW');
    const isRanked = state.queue === 'RANKED';
    const coinsAwarded = isRanked
      ? result === BattleResult.WIN
        ? 180
        : result === BattleResult.DRAW
          ? 95
          : 55
      : result === BattleResult.WIN
        ? 130
        : result === BattleResult.DRAW
          ? 70
          : 40;
    const xpAwarded = isRanked
      ? result === BattleResult.WIN
        ? 130
        : result === BattleResult.DRAW
          ? 80
          : 45
      : result === BattleResult.WIN
        ? 90
        : result === BattleResult.DRAW
          ? 55
          : 30;

    await this.prisma.$transaction(async (tx) => {
      const before = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { rating: true, xp: true, level: true },
      });

      const ratingDelta = isRanked
        ? (() => {
            const opponentRating = state.opponentRating ?? before.rating;
            const actual = result === BattleResult.WIN ? 1 : result === BattleResult.DRAW ? 0.5 : 0;
            const expected = 1 / (1 + 10 ** ((opponentRating - before.rating) / 400));
            return Math.round(28 * (actual - expected));
          })()
        : result === BattleResult.WIN
          ? 18
          : result === BattleResult.DRAW
            ? 0
            : -12;

      const xpAfter = before.xp + xpAwarded;
      const levelGain = Math.floor(xpAfter / 1000);
      const normalizedXp = xpAfter % 1000;
      const levelAfter = before.level + levelGain;
      const ratingAfter = Math.max(0, before.rating + ratingDelta);
      state.result = result;
      state.rewards = { coins: coinsAwarded, xp: xpAwarded };
      state.ratingDelta = ratingDelta;

      await tx.user.update({
        where: { id: userId },
        data: {
          coins: { increment: coinsAwarded },
          xp: normalizedXp,
          level: levelAfter,
          rating: ratingAfter,
        },
      });

      await tx.battle.update({
        where: { id: battleId },
        data: {
          mode: isRanked ? BattleMode.RANKED : BattleMode.AI,
          playerATeamId: playerTeamId,
          resultForA: result,
          playerARatingBefore: before.rating,
          playerARatingAfter: ratingAfter,
          playerBRatingBefore: isRanked ? (state.opponentRating ?? null) : null,
          playerBRatingAfter: isRanked ? (state.opponentRating ?? null) : null,
          coinsAwardedA: coinsAwarded,
          battleLogJson: state as Prisma.JsonObject,
          finishedAt: new Date(),
        },
      });

      await tx.currencyTransaction.create({
        data: {
          userId,
          currencyType: CurrencyType.COINS,
          amount: coinsAwarded,
          transactionType: TransactionType.BATTLE_REWARD,
          referenceId: battleId,
          metadata: {
            mode: isRanked ? 'LIVE_RANKED' : 'LIVE',
            result,
            ratingDelta,
          },
        },
      });
    });
  }

  private randomFloat(min: number, max: number): number {
    return Math.random() * (max - min) + min;
  }
}
