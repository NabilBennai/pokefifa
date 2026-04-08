import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { PacksService } from './packs.service';

@UseGuards(JwtAuthGuard)
@Controller('packs')
export class PacksController {
  constructor(private readonly packsService: PacksService) {}

  @Get('my')
  async getMyPacks(@CurrentUser() user: AuthenticatedUser | undefined) {
    if (!user) {
      return [];
    }

    return this.packsService.getMyPacks(user.userId);
  }

  @Get('history')
  async getPackHistory(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Query('limit') limit?: string,
  ) {
    if (!user) {
      return [];
    }

    return this.packsService.getPackHistory(user.userId, limit);
  }

  @Post(':id/open')
  async openPack(@CurrentUser() user: AuthenticatedUser | undefined, @Param('id') id: string) {
    if (!user) {
      return null;
    }

    return this.packsService.openPack(user.userId, id);
  }
}
