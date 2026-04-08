import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { PacksService } from './packs.service';
import { PurchasePackDto } from './dto/purchase-pack.dto';

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

  @Get('store')
  async getStore() {
    return this.packsService.getStorePacks();
  }

  @Post('purchase/:packDefinitionId')
  async purchasePack(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('packDefinitionId') packDefinitionId: string,
    @Body() dto: PurchasePackDto,
  ) {
    if (!user) {
      return null;
    }

    return this.packsService.purchasePack(user.userId, packDefinitionId, dto.currencyType);
  }
}
