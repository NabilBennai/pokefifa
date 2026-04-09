import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { CreaturesService } from '../../core/services/creatures.service';
import { PacksService } from '../../core/services/packs.service';
import { TranslatePipe } from '../../shared/pipes/t.pipe';

@Component({
  selector: 'app-dashboard-page',
  imports: [RouterLink, TranslatePipe],
  templateUrl: './dashboard.page.html',
})
export class DashboardPageComponent {
  private readonly packsService = inject(PacksService);
  private readonly creaturesService = inject(CreaturesService);

  protected readonly user = inject(AuthService).user;
  protected readonly loadingPacks = signal(false);
  protected readonly loadingCreatures = signal(false);
  protected readonly packsError = signal<string | null>(null);
  protected readonly creaturesError = signal<string | null>(null);
  protected readonly unopenedPackCount = signal(0);
  protected readonly creatureCount = signal(0);

  constructor() {
    this.loadPacks();
    this.loadCreatures();
  }

  protected loadPacks(): void {
    this.loadingPacks.set(true);
    this.packsError.set(null);
    this.packsService
      .getMyPacks()
      .pipe(finalize(() => this.loadingPacks.set(false)))
      .subscribe({
        next: (response) => {
          this.unopenedPackCount.set(response.packs.length);
        },
        error: (error: HttpErrorResponse) => {
          this.packsError.set(error.error?.message ?? 'Could not load packs.');
        },
      });
  }

  protected loadCreatures(): void {
    this.loadingCreatures.set(true);
    this.creaturesError.set(null);
    this.creaturesService.getMyCreatures().subscribe({
      next: (response) => {
        this.creatureCount.set(response.creatures.length);
        this.loadingCreatures.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.creaturesError.set(error.error?.message ?? 'Could not load your creatures.');
        this.loadingCreatures.set(false);
      },
    });
  }
}
