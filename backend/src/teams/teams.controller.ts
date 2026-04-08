import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { TeamsService } from './teams.service';

@UseGuards(JwtAuthGuard)
@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  async getMyTeams(@CurrentUser() user: AuthenticatedUser | undefined) {
    if (!user) {
      return [];
    }
    return this.teamsService.getMyTeams(user.userId);
  }

  @Post()
  async createTeam(@CurrentUser() user: AuthenticatedUser | undefined, @Body() dto: CreateTeamDto) {
    if (!user) {
      return null;
    }
    return this.teamsService.createTeam(user.userId, dto);
  }

  @Patch(':id')
  async updateTeam(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('id') id: string,
    @Body() dto: UpdateTeamDto,
  ) {
    if (!user) {
      return null;
    }
    return this.teamsService.updateTeam(user.userId, id, dto);
  }
}
