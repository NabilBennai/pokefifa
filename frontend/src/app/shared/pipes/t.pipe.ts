import { Pipe, PipeTransform, inject } from '@angular/core';
import { LanguageService } from '../../core/i18n/language.service';

type TranslationKey = string;

@Pipe({
  name: 't',
  standalone: true,
  pure: false,
})
export class TranslatePipe implements PipeTransform {
  private readonly languageService = inject(LanguageService);

  transform(
    key: TranslationKey,
    params?: Record<string, string | number | null | undefined>,
  ): string {
    return this.languageService.t(key, params);
  }
}
