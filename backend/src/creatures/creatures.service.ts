import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CreaturesService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyCreatures(userId: string) {
    const creatures = await this.prisma.userCreature.findMany({
      where: {
        userId,
      },
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
      orderBy: [
        {
          createdAt: 'desc',
        },
      ],
    });

    return {
      totalCreatures: creatures.length,
      creatures,
    };
  }
}
