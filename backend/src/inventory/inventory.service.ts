import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async getInventoryOverview(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        coins: true,
        gems: true,
        shards: true,
        rating: true,
        level: true,
        xp: true,
      },
    });
    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const [creaturesCount, itemsCount, unopenedPacks] = await Promise.all([
      this.prisma.userCreature.count({ where: { userId } }),
      this.prisma.userInventoryItem.count({ where: { userId, quantity: { gt: 0 } } }),
      this.prisma.userPack.count({ where: { userId, openedAt: null } }),
    ]);

    return {
      currencies: {
        coins: user.coins,
        gems: user.gems,
        shards: user.shards,
      },
      progression: {
        rating: user.rating,
        level: user.level,
        xp: user.xp,
      },
      totals: {
        creatures: creaturesCount,
        items: itemsCount,
        unopenedPacks,
      },
    };
  }

  async getInventoryCreatures(userId: string) {
    const creatures = await this.prisma.userCreature.findMany({
      where: { userId },
      include: {
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
      orderBy: [{ createdAt: 'desc' }],
    });

    return {
      total: creatures.length,
      creatures,
    };
  }

  async getInventoryItems(userId: string) {
    const items = await this.prisma.userInventoryItem.findMany({
      where: {
        userId,
        quantity: {
          gt: 0,
        },
      },
      include: {
        item: {
          select: {
            id: true,
            slug: true,
            name: true,
            type: true,
            description: true,
          },
        },
      },
      orderBy: [{ quantity: 'desc' }, { item: { name: 'asc' } }],
    });

    return {
      total: items.length,
      items,
    };
  }
}
