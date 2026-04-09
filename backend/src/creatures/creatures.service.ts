import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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
              orderBy: [{ unlockLevel: 'asc' }],
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
          orderBy: [{ slot: 'asc' }],
        },
      },
      orderBy: [
        {
          createdAt: 'desc',
        },
      ],
    });

    const normalized = creatures.map((creature) => {
      const availableMoves = creature.species.moves
        .filter((entry) => entry.isDefault || entry.unlockLevel <= creature.level)
        .map((entry) => entry.move);

      return {
        ...creature,
        availableMoves,
      };
    });

    return {
      totalCreatures: normalized.length,
      creatures: normalized,
    };
  }

  async updateCreatureMoves(userId: string, creatureId: string, moveIds: string[]) {
    const uniqueMoveIds = Array.from(
      new Set(moveIds.map((id) => id.trim()).filter((id) => id.length > 0)),
    );
    if (uniqueMoveIds.length !== moveIds.length) {
      throw new BadRequestException('Move list contains duplicates or invalid entries.');
    }
    if (uniqueMoveIds.length === 0 || uniqueMoveIds.length > 4) {
      throw new BadRequestException('A creature must have between 1 and 4 selected moves.');
    }

    const creature = await this.prisma.userCreature.findFirst({
      where: {
        id: creatureId,
        userId,
      },
      select: {
        id: true,
        level: true,
        speciesId: true,
      },
    });
    if (!creature) {
      throw new NotFoundException('Creature not found.');
    }

    const speciesMoves = await this.prisma.speciesMove.findMany({
      where: {
        speciesId: creature.speciesId,
      },
      select: {
        unlockLevel: true,
        isDefault: true,
        moveId: true,
      },
    });

    const learnableMoveIds = new Set(
      speciesMoves
        .filter((entry) => entry.isDefault || entry.unlockLevel <= creature.level)
        .map((entry) => entry.moveId),
    );

    for (const moveId of uniqueMoveIds) {
      if (!learnableMoveIds.has(moveId)) {
        throw new BadRequestException(
          'One or more selected moves are not learnable by this creature.',
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userCreatureMove.deleteMany({
        where: {
          userCreatureId: creature.id,
        },
      });

      await tx.userCreatureMove.createMany({
        data: uniqueMoveIds.map((moveId, index) => ({
          userCreatureId: creature.id,
          moveId,
          slot: index + 1,
        })),
      });
    });

    return {
      success: true,
      creatureId: creature.id,
      moveIds: uniqueMoveIds,
    };
  }
}
