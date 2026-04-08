import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TeamStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyTeams(userId: string) {
    const teams = await this.prisma.team.findMany({
      where: { userId },
      include: this.teamInclude(),
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });

    return {
      total: teams.length,
      teams,
    };
  }

  async createTeam(userId: string, dto: CreateTeamDto) {
    const creatureIds = dto.creatureIds ?? [];
    await this.assertCreaturesOwnedByUser(userId, creatureIds);

    const team = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.team.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
      }

      const created = await tx.team.create({
        data: {
          userId,
          name: dto.name.trim(),
          status: dto.status ?? TeamStatus.ACTIVE,
          isDefault: dto.isDefault ?? false,
        },
      });

      if (creatureIds.length > 0) {
        await tx.teamSlot.createMany({
          data: creatureIds.map((userCreatureId, index) => ({
            teamId: created.id,
            userCreatureId,
            slot: index + 1,
          })),
        });
      }

      return tx.team.findUniqueOrThrow({
        where: { id: created.id },
        include: this.teamInclude(),
      });
    });

    return team;
  }

  async updateTeam(userId: string, teamId: string, dto: UpdateTeamDto) {
    const team = await this.prisma.team.findFirst({
      where: {
        id: teamId,
        userId,
      },
      select: {
        id: true,
      },
    });
    if (!team) {
      throw new NotFoundException('Team not found.');
    }

    const creatureIds = dto.creatureIds;
    if (creatureIds) {
      await this.assertCreaturesOwnedByUser(userId, creatureIds);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault === true) {
        await tx.team.updateMany({
          where: { userId, isDefault: true, id: { not: teamId } },
          data: { isDefault: false },
        });
      }

      const updateData: Prisma.TeamUpdateInput = {};
      if (dto.name !== undefined) {
        updateData.name = dto.name.trim();
      }
      if (dto.status !== undefined) {
        updateData.status = dto.status;
      }
      if (dto.isDefault !== undefined) {
        updateData.isDefault = dto.isDefault;
      }

      await tx.team.update({
        where: { id: teamId },
        data: updateData,
      });

      if (creatureIds) {
        await tx.teamSlot.deleteMany({
          where: { teamId },
        });
        if (creatureIds.length > 0) {
          await tx.teamSlot.createMany({
            data: creatureIds.map((userCreatureId, index) => ({
              teamId,
              userCreatureId,
              slot: index + 1,
            })),
          });
        }
      }

      return tx.team.findUniqueOrThrow({
        where: { id: teamId },
        include: this.teamInclude(),
      });
    });

    return updated;
  }

  private async assertCreaturesOwnedByUser(userId: string, creatureIds: string[]) {
    if (creatureIds.length > 6) {
      throw new BadRequestException('A team cannot contain more than 6 creatures.');
    }

    const uniqueIds = Array.from(new Set(creatureIds));
    if (uniqueIds.length !== creatureIds.length) {
      throw new BadRequestException('A team cannot contain duplicate creatures.');
    }

    if (uniqueIds.length === 0) {
      return;
    }

    const ownedCount = await this.prisma.userCreature.count({
      where: {
        userId,
        id: {
          in: uniqueIds,
        },
      },
    });

    if (ownedCount !== uniqueIds.length) {
      throw new BadRequestException('One or more creatures do not belong to the user.');
    }
  }

  private teamInclude(): Prisma.TeamInclude {
    return {
      slots: {
        include: {
          userCreature: {
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
          },
        },
        orderBy: [{ slot: 'asc' }],
      },
    };
  }
}
