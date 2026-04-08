import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AiBattleDto } from './dto/ai-battle.dto';
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

  @Get('history/me')
  async getMyBattleHistory(@CurrentUser() user: AuthenticatedUser | undefined) {
    if (!user) {
      return [];
    }
    return this.battlesService.getMyBattleHistory(user.userId);
  }
}
