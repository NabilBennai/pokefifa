import { Injectable } from '@nestjs/common';
import { AppLocale } from './locale.types';
import { MESSAGE_TRANSLATIONS } from './translations';

@Injectable()
export class I18nService {
  translateMessage(message: string, locale: AppLocale): string {
    return MESSAGE_TRANSLATIONS[locale][message] ?? message;
  }
}
