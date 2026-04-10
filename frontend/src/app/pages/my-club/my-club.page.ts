import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
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
  private static readonly rarityOrder: Record<MyCreatureItem['species']['rarity'], number> = {
    COMMON: 1,
    RARE: 2,
    EPIC: 3,
    LEGENDARY: 4,
    MYTHIC: 5,
  };

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
  protected readonly searchQuery = signal('');
  protected readonly rarityFilter = signal<'ALL' | MyCreatureItem['species']['rarity']>('ALL');
  protected readonly typeFilter = signal<'ALL' | string>('ALL');
  protected readonly minLevelFilter = signal<number | null>(null);
  protected readonly maxLevelFilter = signal<number | null>(null);
  protected readonly sortBy = signal<'name' | 'level' | 'power' | 'rarity' | 'newest'>('power');
  protected readonly sortDirection = signal<'asc' | 'desc'>('desc');
  protected readonly pageSize = signal(12);
  protected readonly currentPage = signal(1);

  protected readonly typeOptions = computed(() => {
    const types = new Set<string>();
    for (const creature of this.creatures()) {
      types.add(creature.species.primaryType);
      if (creature.species.secondaryType) {
        types.add(creature.species.secondaryType);
      }
    }

    return [...types].sort((a, b) => a.localeCompare(b));
  });

  protected readonly filteredCreatures = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const rarity = this.rarityFilter();
    const type = this.typeFilter();
    const minLevel = this.minLevelFilter();
    const maxLevel = this.maxLevelFilter();
    const sortBy = this.sortBy();
    const direction = this.sortDirection() === 'asc' ? 1 : -1;

    const list = this.creatures().filter((creature) => {
      if (query.length > 0) {
        const translatedName = this.localizedPokemonName(creature).toLowerCase();
        const nickname = creature.nickname?.toLowerCase() ?? '';
        const speciesName = creature.species.name.toLowerCase();
        const slug = creature.species.slug.toLowerCase();
        const matchesQuery =
          nickname.includes(query) ||
          speciesName.includes(query) ||
          slug.includes(query) ||
          translatedName.includes(query);
        if (!matchesQuery) {
          return false;
        }
      }

      if (rarity !== 'ALL' && creature.species.rarity !== rarity) {
        return false;
      }

      if (type !== 'ALL') {
        const primary = creature.species.primaryType.toLowerCase();
        const secondary = creature.species.secondaryType?.toLowerCase() ?? '';
        if (primary !== type.toLowerCase() && secondary !== type.toLowerCase()) {
          return false;
        }
      }

      if (minLevel !== null && creature.level < minLevel) {
        return false;
      }

      if (maxLevel !== null && creature.level > maxLevel) {
        return false;
      }

      return true;
    });

    list.sort((a, b) => {
      if (sortBy === 'name') {
        return (
          this.creatureDisplayName(a).localeCompare(this.creatureDisplayName(b), undefined, {
            sensitivity: 'base',
          }) * direction
        );
      }

      if (sortBy === 'level') {
        return (a.level - b.level) * direction;
      }

      if (sortBy === 'rarity') {
        const rankDiff =
          MyClubPageComponent.rarityOrder[a.species.rarity] -
          MyClubPageComponent.rarityOrder[b.species.rarity];
        if (rankDiff !== 0) {
          return rankDiff * direction;
        }
        return (this.computePower(a) - this.computePower(b)) * direction;
      }

      if (sortBy === 'newest') {
        return (
          (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * direction
        );
      }

      return (this.computePower(a) - this.computePower(b)) * direction;
    });

    return list;
  });

  protected readonly totalPages = computed(() => {
    return Math.max(1, Math.ceil(this.filteredCreatures().length / this.pageSize()));
  });

  protected readonly currentPageSafe = computed(() => {
    return Math.max(1, Math.min(this.currentPage(), this.totalPages()));
  });

  protected readonly paginatedCreatures = computed(() => {
    const page = this.currentPageSafe();
    const size = this.pageSize();
    const start = (page - 1) * size;
    return this.filteredCreatures().slice(start, start + size);
  });

  protected readonly paginationFrom = computed(() => {
    const total = this.filteredCreatures().length;
    if (total === 0) {
      return 0;
    }
    return (this.currentPageSafe() - 1) * this.pageSize() + 1;
  });

  protected readonly paginationTo = computed(() => {
    const total = this.filteredCreatures().length;
    if (total === 0) {
      return 0;
    }
    return Math.min(this.currentPageSafe() * this.pageSize(), total);
  });

  constructor() {
    this.loadCreatures();
  }

  protected loadCreatures(): void {
    this.loadingCreatures.set(true);
    this.creaturesError.set(null);
    this.creaturesService.getMyCreatures().subscribe({
      next: (response) => {
        this.creatures.set(response.creatures);
        this.currentPage.set(1);
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

  protected setSearchQuery(value: string): void {
    this.searchQuery.set(value);
    this.currentPage.set(1);
  }

  protected setRarityFilter(value: string): void {
    if (value === 'ALL') {
      this.rarityFilter.set('ALL');
      this.currentPage.set(1);
      return;
    }

    const valid = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC'] as const;
    if (valid.includes(value as (typeof valid)[number])) {
      this.rarityFilter.set(value as MyCreatureItem['species']['rarity']);
      this.currentPage.set(1);
    }
  }

  protected setTypeFilter(value: string): void {
    this.typeFilter.set(value === 'ALL' ? 'ALL' : value);
    this.currentPage.set(1);
  }

  protected setMinLevelFilter(raw: string): void {
    this.minLevelFilter.set(this.parseLevelFilter(raw));
    this.currentPage.set(1);
  }

  protected setMaxLevelFilter(raw: string): void {
    this.maxLevelFilter.set(this.parseLevelFilter(raw));
    this.currentPage.set(1);
  }

  protected setSortBy(value: string): void {
    const valid = ['name', 'level', 'power', 'rarity', 'newest'] as const;
    if (valid.includes(value as (typeof valid)[number])) {
      this.sortBy.set(value as 'name' | 'level' | 'power' | 'rarity' | 'newest');
      this.currentPage.set(1);
    }
  }

  protected setSortDirection(value: string): void {
    if (value === 'asc' || value === 'desc') {
      this.sortDirection.set(value);
      this.currentPage.set(1);
    }
  }

  protected resetFilters(): void {
    this.searchQuery.set('');
    this.rarityFilter.set('ALL');
    this.typeFilter.set('ALL');
    this.minLevelFilter.set(null);
    this.maxLevelFilter.set(null);
    this.sortBy.set('power');
    this.sortDirection.set('desc');
    this.currentPage.set(1);
  }

  protected goToPage(page: number): void {
    const normalized = Math.max(1, Math.min(page, this.totalPages()));
    this.currentPage.set(normalized);
  }

  protected goToPreviousPage(): void {
    this.goToPage(this.currentPageSafe() - 1);
  }

  protected goToNextPage(): void {
    this.goToPage(this.currentPageSafe() + 1);
  }

  private translateMoveName(slug: string, fallback: string): string {
    const key = `move.${slug}`;
    const translated = this.languageService.t(key);
    return translated === key ? fallback : translated;
  }

  private parseLevelFilter(raw: string): number | null {
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    return Math.max(1, Math.min(100, parsed));
  }

  private computePower(creature: MyCreatureItem): number {
    const species = creature.species;
    return (
      species.baseHp +
      species.baseAttack +
      species.baseDefense +
      species.baseSpAttack +
      species.baseSpDefense +
      species.baseSpeed
    );
  }

  private localizedPokemonName(creature: MyCreatureItem): string {
    const key = `pokemon.${creature.species.slug}`;
    const translated = this.languageService.t(key);
    return translated === key ? creature.species.name : translated;
  }

  private creatureDisplayName(creature: MyCreatureItem): string {
    return creature.nickname?.trim() || this.localizedPokemonName(creature);
  }
}
