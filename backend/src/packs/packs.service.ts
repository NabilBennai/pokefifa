import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

type WeightedItem = {
  weight: number;
};

@Injectable()
export class PacksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async getMyPacks(userId: string) {
    const unopened = await this.prisma.userPack.findMany({
      where: {
        userId,
        openedAt: null,
      },
      include: {
        packDefinition: {
          select: {
            slug: true,
            name: true,
            type: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const totalUnopened = unopened.length;
    return {
      totalUnopened,
      packs: unopened,
    };
  }

  async getPackHistory(userId: string, limitRaw?: string) {
    const parsedLimit = Number.parseInt(limitRaw ?? '', 10);
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 50) : 10;

    const history = await this.prisma.userPack.findMany({
      where: {
        userId,
        openedAt: {
          not: null,
        },
      },
      include: {
        packDefinition: {
          select: {
            id: true,
            slug: true,
            name: true,
            type: true,
          },
        },
        rewards: {
          select: {
            id: true,
            rewardType: true,
            quantity: true,
            species: {
              select: {
                id: true,
                slug: true,
                name: true,
                rarity: true,
                primaryType: true,
                secondaryType: true,
                baseHp: true,
                baseAttack: true,
                baseDefense: true,
                baseSpAttack: true,
                baseSpDefense: true,
                baseSpeed: true,
              },
            },
            item: {
              select: {
                id: true,
                slug: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        openedAt: 'desc',
      },
      take: limit,
    });

    return {
      totalOpened: history.length,
      history,
    };
  }

  async openPack(userId: string, userPackId: string) {
    const pack = await this.prisma.userPack.findFirst({
      where: {
        id: userPackId,
        userId,
      },
      include: {
        packDefinition: {
          include: {
            creatureDrops: true,
            itemDrops: true,
          },
        },
      },
    });

    if (!pack) {
      throw new NotFoundException('Pack not found.');
    }
    if (pack.openedAt) {
      throw new BadRequestException('Pack already opened.');
    }

    const creatureRewardCount = this.getPositiveIntEnv('PACK_OPEN_CREATURE_REWARDS', 1);
    const itemRewardCount = this.getPositiveIntEnv('PACK_OPEN_ITEM_REWARDS', 1);

    const result = await this.prisma.$transaction(async (tx) => {
      const freshPack = await tx.userPack.findFirst({
        where: {
          id: userPackId,
          userId,
          openedAt: null,
        },
        include: {
          packDefinition: {
            include: {
              creatureDrops: true,
              itemDrops: true,
            },
          },
        },
      });

      if (!freshPack) {
        throw new BadRequestException('Pack already opened.');
      }

      const rewards: Array<{
        id: string;
        rewardType: string;
        quantity: number;
        species?: {
          id: string;
          slug: string;
          name: string;
          rarity: string;
          primaryType: string;
          secondaryType: string | null;
          baseHp: number;
          baseAttack: number;
          baseDefense: number;
          baseSpAttack: number;
          baseSpDefense: number;
          baseSpeed: number;
        } | null;
        item?: { id: string; slug: string; name: string } | null;
      }> = [];

      for (let i = 0; i < creatureRewardCount; i += 1) {
        if (freshPack.packDefinition.creatureDrops.length === 0) {
          break;
        }
        const picked = this.pickWeighted(freshPack.packDefinition.creatureDrops);
        const userCreature = await tx.userCreature.create({
          data: {
            userId,
            speciesId: picked.speciesId,
          },
          select: {
            species: {
              select: {
                id: true,
                slug: true,
                name: true,
                rarity: true,
                primaryType: true,
                secondaryType: true,
                baseHp: true,
                baseAttack: true,
                baseDefense: true,
                baseSpAttack: true,
                baseSpDefense: true,
                baseSpeed: true,
              },
            },
          },
        });

        const reward = await tx.packOpeningReward.create({
          data: {
            userPackId: freshPack.id,
            rewardType: 'CREATURE',
            speciesId: picked.speciesId,
            quantity: 1,
          },
          select: {
            id: true,
            rewardType: true,
            quantity: true,
          },
        });

        rewards.push({
          ...reward,
          species: userCreature.species,
          item: null,
        });
      }

      for (let i = 0; i < itemRewardCount; i += 1) {
        if (freshPack.packDefinition.itemDrops.length === 0) {
          break;
        }
        const picked = this.pickWeighted(freshPack.packDefinition.itemDrops);
        const quantity = this.randomIntBetween(picked.quantityMin, picked.quantityMax);

        const inventoryItem = await tx.userInventoryItem.upsert({
          where: {
            userId_itemId: {
              userId,
              itemId: picked.itemId,
            },
          },
          update: {
            quantity: {
              increment: quantity,
            },
          },
          create: {
            userId,
            itemId: picked.itemId,
            quantity,
          },
          select: {
            item: {
              select: {
                id: true,
                slug: true,
                name: true,
              },
            },
          },
        });

        const reward = await tx.packOpeningReward.create({
          data: {
            userPackId: freshPack.id,
            rewardType: 'ITEM',
            itemId: picked.itemId,
            quantity,
          },
          select: {
            id: true,
            rewardType: true,
            quantity: true,
          },
        });

        rewards.push({
          ...reward,
          species: null,
          item: inventoryItem.item,
        });
      }

      if (rewards.length === 0) {
        throw new BadRequestException('Pack has no configured drops.');
      }

      const openedPack = await tx.userPack.update({
        where: {
          id: freshPack.id,
        },
        data: {
          openedAt: new Date(),
        },
        include: {
          packDefinition: {
            select: {
              id: true,
              slug: true,
              name: true,
              type: true,
            },
          },
        },
      });

      return {
        userPackId: openedPack.id,
        pack: openedPack.packDefinition,
        openedAt: openedPack.openedAt,
        rewards,
      };
    });

    return result;
  }

  private pickWeighted<T extends WeightedItem>(items: T[]): T {
    const totalWeight = items.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
    if (totalWeight <= 0) {
      return items[Math.floor(Math.random() * items.length)];
    }

    let roll = Math.random() * totalWeight;
    for (const item of items) {
      roll -= Math.max(0, item.weight);
      if (roll <= 0) {
        return item;
      }
    }

    return items[items.length - 1];
  }

  private randomIntBetween(min: number, max: number): number {
    const low = Math.min(min, max);
    const high = Math.max(min, max);
    return Math.floor(Math.random() * (high - low + 1)) + low;
  }

  private getPositiveIntEnv(key: string, fallback: number): number {
    const raw = this.configService.get<string>(key);
    if (!raw) {
      return fallback;
    }

    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }

    return Math.max(0, parsed);
  }
}
