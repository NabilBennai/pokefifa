import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AiBattleDto } from './dto/ai-battle.dto';
import { RankedBattleDto } from './dto/ranked-battle.dto';
import { LiveBattleStartDto } from './dto/live-battle-start.dto';
import { LiveBattleActionDto } from './dto/live-battle-action.dto';
import { BattlesService } from './battles.service';

@UseGuards(JwtAuthGuard)
@Controller('battles')
export class BattlesController {
  constructor(private readonly battlesService: BattlesService) {}

  @Post('ai')
  async runAiBattle(@CurrentUser() user: AuthenticatedUser | undefined, @Body() dto: AiBattleDto) {
    if (!user) {
      return null;
    }
    return this.battlesService.runAiBattle(user.userId, dto.teamId);
  }

  @Post('ranked')
  async runRankedBattle(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Body() dto: RankedBattleDto,
  ) {
    if (!user) {
      return null;
    }
    return this.battlesService.runRankedBattle(user.userId, dto.teamId);
  }

  @Get('history/me')
  async getMyBattleHistory(@CurrentUser() user: AuthenticatedUser | undefined) {
    if (!user) {
      return [];
    }
    return this.battlesService.getMyBattleHistory(user.userId);
  }

  @Post('live/start')
  async startLiveBattle(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Body() dto: LiveBattleStartDto,
  ) {
    if (!user) {
      return null;
    }
    return this.battlesService.startLiveBattle(user.userId, dto.teamId);
  }

  @Get('live/:id')
  async getLiveBattle(@CurrentUser() user: AuthenticatedUser | undefined, @Param('id') id: string) {
    if (!user) {
      return null;
    }
    return this.battlesService.getLiveBattle(user.userId, id);
  }

  @Post('live/:id/action')
  async playLiveBattleTurn(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('id') id: string,
    @Body() dto: LiveBattleActionDto,
  ) {
    if (!user) {
      return null;
    }
    return this.battlesService.playLiveBattleTurn(user.userId, id, dto.moveIndex);
  }
}
