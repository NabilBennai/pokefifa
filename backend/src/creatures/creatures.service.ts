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
        pendingMoves: {
          select: {
            id: true,
            unlockLevel: true,
            createdAt: true,
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
          orderBy: [{ createdAt: 'asc' }],
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

  async resolvePendingMove(
    userId: string,
    creatureId: string,
    pendingMoveId: string,
    replaceMoveId?: string,
    skip = false,
  ) {
    const creature = await this.prisma.userCreature.findFirst({
      where: {
        id: creatureId,
        userId,
      },
      select: {
        id: true,
      },
    });
    if (!creature) {
      throw new NotFoundException('Creature not found.');
    }

    const pending = await this.prisma.userCreaturePendingMove.findFirst({
      where: {
        id: pendingMoveId,
        userCreatureId: creature.id,
      },
      select: {
        id: true,
        moveId: true,
      },
    });
    if (!pending) {
      throw new NotFoundException('Pending move not found.');
    }

    const learnedMoves = await this.prisma.userCreatureMove.findMany({
      where: {
        userCreatureId: creature.id,
      },
      select: {
        id: true,
        slot: true,
        moveId: true,
      },
      orderBy: [{ slot: 'asc' }],
    });

    const alreadyLearned = learnedMoves.some((entry) => entry.moveId === pending.moveId);
    if (skip || alreadyLearned) {
      await this.prisma.userCreaturePendingMove.delete({
        where: { id: pending.id },
      });
      return {
        success: true,
        creatureId: creature.id,
        pendingMoveId: pending.id,
        action: alreadyLearned ? 'ALREADY_LEARNED' : 'SKIPPED',
      };
    }

    if (learnedMoves.length >= 4 && !replaceMoveId) {
      throw new BadRequestException('A replacement move is required because all 4 slots are full.');
    }

    await this.prisma.$transaction(async (tx) => {
      if (replaceMoveId) {
        const toReplace = learnedMoves.find((entry) => entry.moveId === replaceMoveId);
        if (!toReplace) {
          throw new BadRequestException('Selected replacement move is not currently learned.');
        }

        await tx.userCreatureMove.update({
          where: { id: toReplace.id },
          data: {
            moveId: pending.moveId,
          },
        });
      } else {
        const nextSlot = (learnedMoves[learnedMoves.length - 1]?.slot ?? 0) + 1;
        await tx.userCreatureMove.create({
          data: {
            userCreatureId: creature.id,
            moveId: pending.moveId,
            slot: nextSlot,
          },
        });
      }

      await tx.userCreaturePendingMove.delete({
        where: {
          id: pending.id,
        },
      });
    });

    return {
      success: true,
      creatureId: creature.id,
      pendingMoveId: pending.id,
      action: replaceMoveId ? 'REPLACED' : 'LEARNED',
    };
  }
}
