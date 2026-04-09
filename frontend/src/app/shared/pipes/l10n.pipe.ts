import { Pipe, PipeTransform, inject } from '@angular/core';
import { LanguageService } from '../../core/i18n/language.service';

@Pipe({
  name: 'l10n',
  standalone: true,
  pure: false,
})
export class L10nPipe implements PipeTransform {
  private readonly languageService = inject(LanguageService);

  transform(
    value: string | null | undefined,
    prefix: string,
    fallback?: string | null | undefined,
  ): string {
    if (!value) {
      return fallback ?? '';
    }

    const normalized = value.trim().toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-');
    const key = `${prefix}.${normalized}`;
    const translated = this.languageService.t(key);

    if (translated === key) {
      return fallback ?? value;
    }
    return translated;
  }
}
