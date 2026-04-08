import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SpeciesService {
  constructor(private readonly prisma: PrismaService) {}

  async listSpecies() {
    const species = await this.prisma.creatureSpecies.findMany({
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
        description: true,
      },
      orderBy: [{ name: 'asc' }],
    });

    return {
      total: species.length,
      species,
    };
  }

  async getSpeciesByIdOrSlug(idOrSlug: string) {
    const species = await this.prisma.creatureSpecies.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      },
      include: {
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
                pp: true,
                description: true,
              },
            },
          },
          orderBy: [{ unlockLevel: 'asc' }, { move: { name: 'asc' } }],
        },
      },
    });

    if (!species) {
      throw new NotFoundException('Species not found.');
    }

    return species;
  }
}
