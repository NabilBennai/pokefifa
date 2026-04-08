import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { MyCreatureItem } from '../../core/models/creature.models';
import { CreaturesService } from '../../core/services/creatures.service';
import { PokemonCardComponent } from '../../shared/components/pokemon-card/pokemon-card.component';

@Component({
  selector: 'app-my-club-page',
  imports: [PokemonCardComponent],
  templateUrl: './my-club.page.html',
})
export class MyClubPageComponent {
  private readonly creaturesService = inject(CreaturesService);

  protected readonly loadingCreatures = signal(false);
  protected readonly creaturesError = signal<string | null>(null);
  protected readonly creatures = signal<MyCreatureItem[]>([]);

  constructor() {
    this.loadCreatures();
  }

  protected loadCreatures(): void {
    this.loadingCreatures.set(true);
    this.creaturesError.set(null);
    this.creaturesService.getMyCreatures().subscribe({
      next: (response) => {
        this.creatures.set(response.creatures);
        this.loadingCreatures.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.creaturesError.set(error.error?.message ?? 'Could not load your creatures.');
        this.loadingCreatures.set(false);
      },
    });
  }
}
