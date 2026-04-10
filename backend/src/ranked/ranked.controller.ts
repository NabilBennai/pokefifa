import { Body, Controller, Get, Headers, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SeasonResetDto } from './dto/season-reset.dto';
import { RankedService } from './ranked.service';

@Controller('ranked')
export class RankedController {
  constructor(private readonly rankedService: RankedService) {}

  @UseGuards(JwtAuthGuard)
  @Get('overview')
  async getOverview(@CurrentUser() user: AuthenticatedUser | undefined) {
    if (!user) {
      return null;
    }
    return this.rankedService.getOverview(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('season/claim')
  async claimSeasonReward(@CurrentUser() user: AuthenticatedUser | undefined) {
    if (!user) {
      return null;
    }
    return this.rankedService.claimSeasonReward(user.userId);
  }

  @Post('season/reset')
  async resetSeason(
    @Headers('x-admin-key') adminKey: string | undefined,
    @Body() dto: SeasonResetDto,
  ) {
    return this.rankedService.runSeasonReset(adminKey, dto);
  }
}
