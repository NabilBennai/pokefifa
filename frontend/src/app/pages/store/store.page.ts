import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { LanguageService } from '../../core/i18n/language.service';
import { AuthService } from '../../core/services/auth.service';
import { PacksService } from '../../core/services/packs.service';
import { StorePackItem } from '../../core/models/pack.models';
import { L10nPipe } from '../../shared/pipes/l10n.pipe';
import { TranslatePipe } from '../../shared/pipes/t.pipe';

@Component({
  selector: 'app-store-page',
  imports: [TranslatePipe, L10nPipe],
  templateUrl: './store.page.html',
})
export class StorePageComponent {
  private readonly packsService = inject(PacksService);
  private readonly authService = inject(AuthService);
  private readonly languageService = inject(LanguageService);

  protected readonly user = this.authService.user;
  protected readonly loading = signal(false);
  protected readonly buyingPackId = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);
  protected readonly packs = signal<StorePackItem[]>([]);

  constructor() {
    this.loadStore();
  }

  protected loadStore(): void {
    this.loading.set(true);
    this.error.set(null);
    this.packsService
      .getStore()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (response) => this.packs.set(response.packs),
        error: (error: HttpErrorResponse) => {
          this.error.set(error.error?.message ?? 'Could not load store packs.');
        },
      });
  }

  protected buyPack(pack: StorePackItem, currency: 'COINS' | 'GEMS'): void {
    this.error.set(null);
    this.success.set(null);
    this.buyingPackId.set(`${pack.id}:${currency}`);

    this.packsService
      .purchasePack(pack.id, currency)
      .pipe(finalize(() => this.buyingPackId.set(null)))
      .subscribe({
        next: (response) => {
          const packSlug = response.purchasedPack.packDefinition.slug;
          const packName = this.localized(
            'pack',
            packSlug,
            response.purchasedPack.packDefinition.name,
          );
          const currency = this.localized(
            'currency',
            response.spent.currencyType,
            response.spent.currencyType.toLowerCase(),
          );
          this.success.set(
            `${this.languageService.t('store.purchasedPrefix')} ${packName} ${this.languageService.t('store.purchasedFor')} ${response.spent.amount} ${currency}.`,
          );
          this.authService.refreshProfile().subscribe();
        },
        error: (error: HttpErrorResponse) => {
          this.error.set(error.error?.message ?? 'Purchase failed.');
        },
      });
  }

  protected canBuyCoins(pack: StorePackItem): boolean {
    return pack.coinPrice !== null && (this.user()?.coins ?? 0) >= pack.coinPrice;
  }

  protected canBuyGems(pack: StorePackItem): boolean {
    return pack.gemPrice !== null && (this.user()?.gems ?? 0) >= pack.gemPrice;
  }

  private localized(prefix: string, slug: string, fallback: string): string {
    const key = `${prefix}.${slug.trim().toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-')}`;
    const translated = this.languageService.t(key);
    return translated === key ? fallback : translated;
  }
}
