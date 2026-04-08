import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { finalize, firstValueFrom } from 'rxjs';
import { OpenPackResponse, PackHistoryItem, UserPackListItem } from '../../core/models/pack.models';
import { PacksService } from '../../core/services/packs.service';
import { PokemonCardComponent } from '../../shared/components/pokemon-card/pokemon-card.component';

@Component({
  selector: 'app-packs-page',
  imports: [DatePipe, PokemonCardComponent],
  templateUrl: './packs.page.html',
})
export class PacksPageComponent {
  private readonly packsService = inject(PacksService);

  protected readonly loadingPacks = signal(false);
  protected readonly loadingHistory = signal(false);
  protected readonly packsError = signal<string | null>(null);
  protected readonly openingPackId = signal<string | null>(null);
  protected readonly openingModalOpen = signal(false);
  protected readonly openingModalRevealed = signal(false);
  protected readonly openingModalTitle = signal<string>('Opening pack...');
  protected readonly packs = signal<UserPackListItem[]>([]);
  protected readonly packHistory = signal<PackHistoryItem[]>([]);
  protected readonly openedResult = signal<OpenPackResponse | null>(null);

  constructor() {
    this.loadPacks();
    this.loadPackHistory();
  }

  protected loadPacks(): void {
    this.loadingPacks.set(true);
    this.packsError.set(null);
    this.packsService
      .getMyPacks()
      .pipe(finalize(() => this.loadingPacks.set(false)))
      .subscribe({
        next: (response) => {
          this.packs.set(response.packs);
        },
        error: (error: HttpErrorResponse) => {
          this.packsError.set(error.error?.message ?? 'Could not load packs.');
        },
      });
  }

  protected loadPackHistory(): void {
    this.loadingHistory.set(true);
    this.packsService.getHistory(8).subscribe({
      next: (response) => {
        this.packHistory.set(response.history);
        this.loadingHistory.set(false);
      },
      error: () => {
        this.loadingHistory.set(false);
      },
    });
  }

  protected openPack(packId: string): void {
    const pack = this.packs().find((p) => p.id === packId);
    if (this.openingPackId()) {
      return;
    }

    this.openingModalTitle.set(pack?.packDefinition.name ?? 'Opening pack...');
    this.openingModalRevealed.set(false);
    this.openingModalOpen.set(true);
    this.openingPackId.set(packId);
    this.packsError.set(null);

    void this.performPackOpening(packId);
  }

  protected closeOpeningModal(): void {
    this.openingModalOpen.set(false);
  }

  private async performPackOpening(packId: string): Promise<void> {
    try {
      const resultPromise = firstValueFrom(this.packsService.openPack(packId));
      const revealDelay = new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 1400);
      });
      const [result] = await Promise.all([resultPromise, revealDelay]);
      this.openedResult.set(result);
      this.openingModalRevealed.set(true);
      this.packs.update((current) => current.filter((pack) => pack.id !== packId));
      this.loadPackHistory();
    } catch (error) {
      const httpError = error as HttpErrorResponse;
      this.packsError.set(httpError.error?.message ?? 'Pack opening failed.');
      this.openingModalOpen.set(false);
    } finally {
      this.openingPackId.set(null);
    }
  }
}
