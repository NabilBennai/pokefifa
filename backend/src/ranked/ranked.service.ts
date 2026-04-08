import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CurrencyType, PackSource, TransactionType } from '@prisma/client';
import { SeasonResetDto } from './dto/season-reset.dto';
import { PrismaService } from '../prisma/prisma.service';

type Division = {
  code: 'BRONZE' | 'SILVER' | 'GOLD' | 'DIAMOND' | 'MASTER';
  label: string;
  minRating: number;
  reward: {
    coins: number;
    gems: number;
    shards: number;
    packs: number;
  };
};

const DIVISIONS: Division[] = [
  {
    code: 'BRONZE',
    label: 'Bronze',
    minRating: 0,
    reward: { coins: 600, gems: 15, shards: 0, packs: 0 },
  },
  {
    code: 'SILVER',
    label: 'Silver',
    minRating: 1050,
    reward: { coins: 900, gems: 30, shards: 20, packs: 1 },
  },
  {
    code: 'GOLD',
    label: 'Gold',
    minRating: 1200,
    reward: { coins: 1300, gems: 45, shards: 45, packs: 1 },
  },
  {
    code: 'DIAMOND',
    label: 'Diamond',
    minRating: 1400,
    reward: { coins: 1900, gems: 70, shards: 80, packs: 2 },
  },
  {
    code: 'MASTER',
    label: 'Master',
    minRating: 1650,
    reward: { coins: 2600, gems: 110, shards: 140, packs: 3 },
  },
];

@Injectable()
export class RankedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async getOverview(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        rating: true,
      },
    });

    const currentDivision = this.resolveDivision(user.rating);
    const nextDivision = this.resolveNextDivision(currentDivision.code);
    const season = this.getSeasonConfig();
    const claimReference = this.claimReference(season.id);
    const alreadyClaimed = await this.prisma.currencyTransaction.findFirst({
      where: {
        userId,
        transactionType: TransactionType.QUEST_REWARD,
        referenceId: claimReference,
      },
      select: { id: true },
    });

    return {
      season: {
        id: season.id,
        startsAt: season.startsAt.toISOString(),
        endsAt: season.endsAt.toISOString(),
        isActive: season.isActive,
        hasEnded: season.hasEnded,
        remainingMs: season.remainingMs,
      },
      ladder: {
        rating: user.rating,
        division: currentDivision,
        nextDivision,
      },
      reward: {
        canClaim: season.hasEnded && !alreadyClaimed,
        alreadyClaimed: !!alreadyClaimed,
        preview: currentDivision.reward,
      },
    };
  }

  async claimSeasonReward(userId: string) {
    const season = this.getSeasonConfig();
    if (!season.hasEnded) {
      throw new BadRequestException('Season is still active.');
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        rating: true,
      },
    });

    const division = this.resolveDivision(user.rating);
    const claimReference = this.claimReference(season.id);
    const packSlug = this.configService.get<string>('SEASON_REWARD_PACK_SLUG', 'silver_pack');

    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.currencyTransaction.findFirst({
        where: {
          userId,
          transactionType: TransactionType.QUEST_REWARD,
          referenceId: claimReference,
        },
        select: { id: true },
      });
      if (existing) {
        throw new BadRequestException('Season reward already claimed.');
      }

      const increments = {
        coins: division.reward.coins,
        gems: division.reward.gems,
        shards: division.reward.shards,
      };

      await tx.user.update({
        where: { id: userId },
        data: {
          coins: { increment: increments.coins },
          gems: { increment: increments.gems },
          shards: { increment: increments.shards },
        },
      });

      const logs: Array<{ currencyType: CurrencyType; amount: number }> = [];
      if (increments.coins > 0) {
        logs.push({ currencyType: CurrencyType.COINS, amount: increments.coins });
      }
      if (increments.gems > 0) {
        logs.push({ currencyType: CurrencyType.GEMS, amount: increments.gems });
      }
      if (increments.shards > 0) {
        logs.push({ currencyType: CurrencyType.SHARDS, amount: increments.shards });
      }

      for (const log of logs) {
        await tx.currencyTransaction.create({
          data: {
            userId,
            currencyType: log.currencyType,
            amount: log.amount,
            transactionType: TransactionType.QUEST_REWARD,
            referenceId: claimReference,
            metadata: {
              source: 'season_reward',
              seasonId: season.id,
              division: division.code,
            },
          },
        });
      }

      let rewardedPacks = 0;
      if (division.reward.packs > 0) {
        const packDefinition = await tx.packDefinition.findFirst({
          where: {
            slug: packSlug,
            isActive: true,
          },
          select: { id: true, slug: true, name: true },
        });
        if (packDefinition) {
          await tx.userPack.createMany({
            data: Array.from({ length: division.reward.packs }, () => ({
              userId,
              packDefinitionId: packDefinition.id,
              source: PackSource.REWARD,
            })),
          });
          rewardedPacks = division.reward.packs;
        }
      }

      return {
        division,
        increments,
        rewardedPacks,
      };
    });

    return {
      seasonId: season.id,
      division: result.division,
      rewards: {
        coins: result.increments.coins,
        gems: result.increments.gems,
        shards: result.increments.shards,
        packs: result.rewardedPacks,
      },
    };
  }

  async runSeasonReset(adminKey: string | undefined, dto: SeasonResetDto) {
    const expectedKey = this.configService.get<string>('RANKED_ADMIN_KEY', '');
    if (!expectedKey || adminKey !== expectedKey) {
      throw new UnauthorizedException('Invalid admin key.');
    }

    const season = this.getSeasonConfig();
    const targetSeasonId = dto.nextSeasonId?.trim() || `${season.id}-reset`;
    const resetReference = `season_reset:${targetSeasonId}`;

    if (!dto.force) {
      const existing = await this.prisma.currencyTransaction.findFirst({
        where: {
          referenceId: resetReference,
          transactionType: TransactionType.ADMIN_GRANT,
        },
        select: { id: true },
      });
      if (existing) {
        throw new BadRequestException('Season reset already executed for this target season.');
      }
    }

    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        rating: true,
      },
    });

    await this.prisma.$transaction(async (tx) => {
      for (const user of users) {
        const newRating = this.computeResetRating(user.rating);
        await tx.user.update({
          where: { id: user.id },
          data: { rating: newRating },
        });

        await tx.currencyTransaction.create({
          data: {
            userId: user.id,
            currencyType: CurrencyType.COINS,
            amount: 0,
            transactionType: TransactionType.ADMIN_GRANT,
            referenceId: resetReference,
            metadata: {
              source: 'season_reset',
              oldRating: user.rating,
              newRating,
            },
          },
        });
      }
    });

    return {
      resetSeasonId: targetSeasonId,
      usersUpdated: users.length,
    };
  }

  private resolveDivision(rating: number): Division {
    let current = DIVISIONS[0];
    for (const division of DIVISIONS) {
      if (rating >= division.minRating) {
        current = division;
      }
    }
    return current;
  }

  private resolveNextDivision(code: Division['code']) {
    const index = DIVISIONS.findIndex((division) => division.code === code);
    if (index < 0 || index === DIVISIONS.length - 1) {
      return null;
    }
    return DIVISIONS[index + 1];
  }

  private getSeasonConfig() {
    const now = Date.now();
    const startsAt = this.parseDateConfig('RANKED_SEASON_START', '2026-01-01T00:00:00.000Z');
    const endsAt = this.parseDateConfig('RANKED_SEASON_END', '2026-12-31T23:59:59.000Z');
    const id = this.configService.get<string>('RANKED_SEASON_ID', '2026-S1');
    return {
      id,
      startsAt,
      endsAt,
      isActive: now >= startsAt.getTime() && now < endsAt.getTime(),
      hasEnded: now >= endsAt.getTime(),
      remainingMs: Math.max(0, endsAt.getTime() - now),
    };
  }

  private parseDateConfig(key: string, fallbackIso: string) {
    const raw = this.configService.get<string>(key);
    if (!raw) {
      return new Date(fallbackIso);
    }
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) {
      return new Date(fallbackIso);
    }
    return date;
  }

  private claimReference(seasonId: string) {
    return `season_reward:${seasonId}`;
  }

  private computeResetRating(rating: number) {
    const anchor = 1000;
    const compressed = Math.round(anchor + (rating - anchor) * 0.6);
    return Math.max(700, Math.min(1900, compressed));
  }
}
