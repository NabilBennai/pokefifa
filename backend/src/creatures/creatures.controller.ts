import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { CreaturesService } from './creatures.service';
import { UpdateCreatureMovesDto } from './dto/update-creature-moves.dto';
import { ResolvePendingMoveDto } from './dto/resolve-pending-move.dto';

@UseGuards(JwtAuthGuard)
@Controller('creatures')
export class CreaturesController {
  constructor(private readonly creaturesService: CreaturesService) {}

  @Get('my')
  async getMyCreatures(@CurrentUser() user: AuthenticatedUser | undefined) {
    if (!user) {
      return [];
    }

    return this.creaturesService.getMyCreatures(user.userId);
  }

  @Patch(':id/moves')
  async updateCreatureMoves(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('id') id: string,
    @Body() dto: UpdateCreatureMovesDto,
  ) {
    if (!user) {
      return null;
    }

    return this.creaturesService.updateCreatureMoves(user.userId, id, dto.moveIds);
  }

  @Post(':id/pending-moves/:pendingMoveId/resolve')
  async resolvePendingMove(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('id') id: string,
    @Param('pendingMoveId') pendingMoveId: string,
    @Body() dto: ResolvePendingMoveDto,
  ) {
    if (!user) {
      return null;
    }

    return this.creaturesService.resolvePendingMove(
      user.userId,
      id,
      pendingMoveId,
      dto.replaceMoveId,
      dto.skip ?? false,
    );
  }
}
