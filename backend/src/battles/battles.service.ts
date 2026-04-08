import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BattleMode, BattleResult, CurrencyType, Prisma, TransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type CombatMove = {
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

const MOVE_SELECT = {
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
        this.toCombatMove(entry.move.name, entry.move.type, entry.move.power, entry.move.accuracy),
      );

    if (defaults.length > 0) {
      return defaults;
    }

    return [this.toCombatMove('Struggle', 'Normal', 40, 100)];
  }

  private toCombatMove(
    name: string,
    type: string | null,
    power: number | null,
    accuracy: number | null,
  ): CombatMove {
    return {
      name,
      type: (type ?? 'Normal').toLowerCase(),
      power: Math.max(1, power ?? 40),
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

      const order: Array<{ actor: Combatant; target: Combatant; move: CombatMove }> =
        attackerA.speed > attackerB.speed
          ? [
              { actor: attackerA, target: attackerB, move: moveA },
              { actor: attackerB, target: attackerA, move: moveB },
            ]
          : attackerA.speed < attackerB.speed
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
    const base =
      (((2 * attacker.level) / 5 + 2) *
        move.power *
        (attacker.attack / Math.max(1, target.defense))) /
        50 +
      2;
    const damage = Math.max(1, Math.floor(base * stab * effectiveness * randomFactor));

    target.currentHp = Math.max(0, target.currentHp - damage);

    if (effectiveness >= 2) {
      return `It dealt ${damage} damage. It's super effective.`;
    }
    if (effectiveness < 1) {
      return `It dealt ${damage} damage. It's not very effective.`;
    }

    return `It dealt ${damage} damage.`;
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

  private randomFloat(min: number, max: number): number {
    return Math.random() * (max - min) + min;
  }
}
