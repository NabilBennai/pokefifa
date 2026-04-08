import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BattleMode, BattleResult, CurrencyType, TransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BattlesService {
  constructor(private readonly prisma: PrismaService) {}

  async runAiBattle(userId: string, requestedTeamId?: string) {
    const playerTeam = await this.resolveTeam(userId, requestedTeamId);
    if (playerTeam.slots.length === 0) {
      throw new BadRequestException('Selected team has no creatures.');
    }

    const playerPower = this.computeTeamPower(playerTeam.slots);
    const aiPower = Math.max(1, Math.round(playerPower * this.randomFloat(0.82, 1.18)));

    const score = playerPower + this.randomFloat(-180, 180) - aiPower;
    let result: BattleResult = BattleResult.DRAW;
    if (score > 25) {
      result = BattleResult.WIN;
    } else if (score < -25) {
      result = BattleResult.LOSS;
    }

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
          playerATeamId: playerTeam.id,
          resultForA: result,
          playerARatingBefore: before.rating,
          playerARatingAfter: ratingAfter,
          coinsAwardedA: coinsAwarded,
          battleLogJson: {
            simulation: true,
            playerPower,
            aiPower,
            score,
            xpAwarded,
            ratingDelta,
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
        id: playerTeam.id,
        name: playerTeam.name,
        power: playerPower,
      },
      opponent: {
        name: 'AI Trainer',
        power: aiPower,
      },
      createdAt: battle.createdAt,
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

  private async resolveTeam(userId: string, requestedTeamId?: string) {
    if (requestedTeamId) {
      const team = await this.prisma.team.findFirst({
        where: {
          id: requestedTeamId,
          userId,
        },
        include: {
          slots: {
            include: {
              userCreature: {
                include: {
                  species: {
                    select: {
                      baseHp: true,
                      baseAttack: true,
                      baseDefense: true,
                      baseSpAttack: true,
                      baseSpDefense: true,
                      baseSpeed: true,
                    },
                  },
                },
              },
            },
          },
        },
      });
      if (!team) {
        throw new NotFoundException('Team not found.');
      }
      return team;
    }

    const defaultTeam = await this.prisma.team.findFirst({
      where: {
        userId,
        isDefault: true,
      },
      include: {
        slots: {
          include: {
            userCreature: {
              include: {
                species: {
                  select: {
                    baseHp: true,
                    baseAttack: true,
                    baseDefense: true,
                    baseSpAttack: true,
                    baseSpDefense: true,
                    baseSpeed: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    if (defaultTeam) {
      return defaultTeam;
    }

    const anyTeam = await this.prisma.team.findFirst({
      where: { userId },
      include: {
        slots: {
          include: {
            userCreature: {
              include: {
                species: {
                  select: {
                    baseHp: true,
                    baseAttack: true,
                    baseDefense: true,
                    baseSpAttack: true,
                    baseSpDefense: true,
                    baseSpeed: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ createdAt: 'asc' }],
    });
    if (!anyTeam) {
      throw new BadRequestException('Create a team before starting battles.');
    }
    return anyTeam;
  }

  private computeTeamPower(
    slots: Array<{
      userCreature: {
        level: number;
        species: {
          baseHp: number;
          baseAttack: number;
          baseDefense: number;
          baseSpAttack: number;
          baseSpDefense: number;
          baseSpeed: number;
        };
      };
    }>,
  ) {
    return slots.reduce((total, slot) => {
      const speciesPower =
        slot.userCreature.species.baseHp +
        slot.userCreature.species.baseAttack +
        slot.userCreature.species.baseDefense +
        slot.userCreature.species.baseSpAttack +
        slot.userCreature.species.baseSpDefense +
        slot.userCreature.species.baseSpeed;
      return total + speciesPower + slot.userCreature.level * 8;
    }, 0);
  }

  private randomFloat(min: number, max: number): number {
    return Math.random() * (max - min) + min;
  }
}
