import { Controller, Get, Param } from '@nestjs/common';
import { SpeciesService } from './species.service';

@Controller('species')
export class SpeciesController {
  constructor(private readonly speciesService: SpeciesService) {}

  @Get()
  async listSpecies() {
    return this.speciesService.listSpecies();
  }

  @Get(':id')
  async getSpecies(@Param('id') id: string) {
    return this.speciesService.getSpeciesByIdOrSlug(id);
  }
}
