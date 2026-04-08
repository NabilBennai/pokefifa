import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { InventoryService } from './inventory.service';

@UseGuards(JwtAuthGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  async getInventory(@CurrentUser() user: AuthenticatedUser | undefined) {
    if (!user) {
      return null;
    }
    return this.inventoryService.getInventoryOverview(user.userId);
  }

  @Get('creatures')
  async getInventoryCreatures(@CurrentUser() user: AuthenticatedUser | undefined) {
    if (!user) {
      return [];
    }
    return this.inventoryService.getInventoryCreatures(user.userId);
  }

  @Get('items')
  async getInventoryItems(@CurrentUser() user: AuthenticatedUser | undefined) {
    if (!user) {
      return [];
    }
    return this.inventoryService.getInventoryItems(user.userId);
  }
}
