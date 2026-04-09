import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AppLocale } from '../../core/i18n/locale.types';
import { LanguageService } from '../../core/i18n/language.service';
import { AuthService } from '../../core/services/auth.service';
import { TranslatePipe } from '../pipes/t.pipe';

@Component({
  selector: 'app-navbar',
  imports: [CommonModule, RouterLink, RouterLinkActive, TranslatePipe],
  templateUrl: './navbar.component.html',
})
export class NavbarComponent {
  protected readonly authService = inject(AuthService);
  protected readonly languageService = inject(LanguageService);
  protected readonly menuOpen = signal(false);
  protected readonly localeOpen = signal(false);
  protected readonly user = this.authService.user;
  protected readonly isAuthenticated = computed(() => !!this.authService.user());
  protected readonly locales = this.languageService.supportedLocales;
  protected readonly currentLocale = this.languageService.locale;

  protected toggleMenu(): void {
    this.menuOpen.update((value) => !value);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
    this.localeOpen.set(false);
  }

  protected logout(): void {
    this.authService.logout();
    this.closeMenu();
  }

  protected toggleLocaleMenu(): void {
    this.localeOpen.update((value) => !value);
  }

  protected setLocale(locale: AppLocale): void {
    void this.languageService.setLocale(locale);
    this.localeOpen.set(false);
  }

  protected localeFlag(locale: AppLocale): string {
    if (locale === 'fr') {
      return '\uD83C\uDDEB\uD83C\uDDF7';
    }
    if (locale === 'es') {
      return '\uD83C\uDDEA\uD83C\uDDF8';
    }
    return '\uD83C\uDDEC\uD83C\uDDE7';
  }
}
