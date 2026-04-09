import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { MyCreatureItem } from '../../core/models/creature.models';
import { LanguageService } from '../../core/i18n/language.service';
import { CreaturesService } from '../../core/services/creatures.service';
import { PokemonCardComponent } from '../../shared/components/pokemon-card/pokemon-card.component';
import { L10nPipe } from '../../shared/pipes/l10n.pipe';
import { TranslatePipe } from '../../shared/pipes/t.pipe';

@Component({
  selector: 'app-my-club-page',
  imports: [PokemonCardComponent, TranslatePipe, L10nPipe],
  templateUrl: './my-club.page.html',
})
export class MyClubPageComponent {
  private readonly creaturesService = inject(CreaturesService);
  private readonly languageService = inject(LanguageService);

  protected readonly loadingCreatures = signal(false);
  protected readonly creaturesError = signal<string | null>(null);
  protected readonly creatures = signal<MyCreatureItem[]>([]);
  protected readonly selectedCreatureId = signal<string | null>(null);
  protected readonly editableMoveIds = signal<string[]>([]);
  protected readonly savingMoves = signal(false);
  protected readonly moveEditorError = signal<string | null>(null);
  protected readonly moveEditorSuccess = signal<string | null>(null);

  constructor() {
    this.loadCreatures();
  }

  protected loadCreatures(): void {
    this.loadingCreatures.set(true);
    this.creaturesError.set(null);
    this.creaturesService.getMyCreatures().subscribe({
      next: (response) => {
        this.creatures.set(response.creatures);
        if (this.selectedCreatureId()) {
          const refreshed = response.creatures.find((c) => c.id === this.selectedCreatureId());
          if (refreshed) {
            this.editableMoveIds.set(refreshed.learnedMoves.map((entry) => entry.move.id));
          }
        }
        this.loadingCreatures.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.creaturesError.set(error.error?.message ?? 'Could not load your creatures.');
        this.loadingCreatures.set(false);
      },
    });
  }

  protected openMoveEditor(creature: MyCreatureItem): void {
    this.selectedCreatureId.set(creature.id);
    this.editableMoveIds.set(creature.learnedMoves.map((entry) => entry.move.id));
    if (this.editableMoveIds().length === 0 && creature.availableMoves.length > 0) {
      this.editableMoveIds.set([creature.availableMoves[0].id]);
    }
    this.moveEditorError.set(null);
    this.moveEditorSuccess.set(null);
  }

  protected closeMoveEditor(): void {
    this.selectedCreatureId.set(null);
    this.editableMoveIds.set([]);
    this.moveEditorError.set(null);
    this.moveEditorSuccess.set(null);
  }

  protected selectedCreature(): MyCreatureItem | null {
    const id = this.selectedCreatureId();
    if (!id) {
      return null;
    }
    return this.creatures().find((creature) => creature.id === id) ?? null;
  }

  protected updateSlotMove(slotIndex: number, moveId: string): void {
    const current = [...this.editableMoveIds()];
    current[slotIndex] = moveId;
    this.editableMoveIds.set(current);
    this.moveEditorError.set(null);
    this.moveEditorSuccess.set(null);
  }

  protected addMoveSlot(): void {
    const creature = this.selectedCreature();
    if (!creature) {
      return;
    }
    const current = [...this.editableMoveIds()];
    if (current.length >= 4 || creature.availableMoves.length === 0) {
      return;
    }

    const fallback =
      creature.availableMoves.find((move) => !current.includes(move.id))?.id ??
      creature.availableMoves[0].id;
    current.push(fallback);
    this.editableMoveIds.set(current);
    this.moveEditorError.set(null);
    this.moveEditorSuccess.set(null);
  }

  protected removeMoveSlot(slotIndex: number): void {
    const current = [...this.editableMoveIds()];
    if (current.length <= 1) {
      return;
    }
    current.splice(slotIndex, 1);
    this.editableMoveIds.set(current);
    this.moveEditorError.set(null);
    this.moveEditorSuccess.set(null);
  }

  protected saveMoves(): void {
    const creature = this.selectedCreature();
    if (!creature) {
      return;
    }

    const moveIds = this.editableMoveIds()
      .map((id) => id.trim())
      .filter((id) => id.length > 0);
    const unique = new Set(moveIds);
    if (moveIds.length === 0 || moveIds.length > 4) {
      this.moveEditorError.set('Select between 1 and 4 moves.');
      return;
    }
    if (unique.size !== moveIds.length) {
      this.moveEditorError.set('Move slots cannot contain duplicates.');
      return;
    }

    this.savingMoves.set(true);
    this.moveEditorError.set(null);
    this.moveEditorSuccess.set(null);

    this.creaturesService
      .updateCreatureMoves(creature.id, moveIds)
      .pipe(finalize(() => this.savingMoves.set(false)))
      .subscribe({
        next: () => {
          this.moveEditorSuccess.set('Moves updated successfully.');
          this.loadCreatures();
        },
        error: (error: HttpErrorResponse) => {
          this.moveEditorError.set(error.error?.message ?? 'Could not save moves.');
        },
      });
  }

  protected currentMoveName(creature: MyCreatureItem, slot: number): string {
    const move = creature.learnedMoves.find((entry) => entry.slot === slot)?.move;
    if (!move) {
      return '-';
    }
    return this.translateMoveName(move.slug, move.name);
  }

  protected moveName(slug: string, fallback: string): string {
    return this.translateMoveName(slug, fallback);
  }

  private translateMoveName(slug: string, fallback: string): string {
    const key = `move.${slug}`;
    const translated = this.languageService.t(key);
    return translated === key ? fallback : translated;
  }
}
