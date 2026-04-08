import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { CreaturesService } from './creatures.service';

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
}
