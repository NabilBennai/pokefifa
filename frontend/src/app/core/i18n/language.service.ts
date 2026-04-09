import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';
import {
  AppLocale,
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  SUPPORTED_LOCALES,
  isSupportedLocale,
} from './locale.types';

type TranslationDictionary = Record<string, string>;
type TranslationKey = string;

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly document = inject(DOCUMENT);
  private readonly localeSignal = signal<AppLocale>(DEFAULT_LOCALE);
  private readonly translationsSignal = signal<Partial<Record<AppLocale, TranslationDictionary>>>(
    {},
  );
  private readonly loadedLocales = new Set<AppLocale>();
  private readonly loadingLocales = new Map<AppLocale, Promise<void>>();
  readonly locale = this.localeSignal.asReadonly();
  readonly supportedLocales = SUPPORTED_LOCALES;
  readonly localeLabel = computed(() => this.localeSignal().toUpperCase());

  async init(): Promise<void> {
    const saved = this.readStoredLocale();
    const browser = this.getBrowserLocale();
    const nextLocale = saved ?? browser ?? DEFAULT_LOCALE;
    await this.loadTranslations(DEFAULT_LOCALE);
    await this.setLocale(nextLocale, false);
  }

  async setLocale(locale: AppLocale, persist = true): Promise<void> {
    await this.loadTranslations(locale);
    this.localeSignal.set(locale);
    this.document.documentElement.lang = locale;
    if (persist) {
      localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    }
  }

  t(key: TranslationKey, params?: Record<string, string | number | null | undefined>): string {
    const locale = this.localeSignal();
    const dictionaries = this.translationsSignal();
    const template = dictionaries[locale]?.[key] ?? dictionaries[DEFAULT_LOCALE]?.[key] ?? key;
    if (!params) {
      return template;
    }
    return Object.entries(params).reduce((output, [paramKey, value]) => {
      return output.replace(new RegExp(`{{\\s*${paramKey}\\s*}}`, 'g'), String(value ?? ''));
    }, template);
  }

  private readStoredLocale(): AppLocale | null {
    const value = globalThis.localStorage?.getItem(LOCALE_STORAGE_KEY);
    return isSupportedLocale(value) ? value : null;
  }

  private getBrowserLocale(): AppLocale | null {
    const candidate = globalThis.navigator?.language?.slice(0, 2).toLowerCase();
    return isSupportedLocale(candidate) ? candidate : null;
  }

  private async loadTranslations(locale: AppLocale): Promise<void> {
    if (this.loadedLocales.has(locale)) {
      return;
    }

    const pending = this.loadingLocales.get(locale);
    if (pending) {
      await pending;
      return;
    }

    const loading = this.fetchTranslations(locale)
      .then((translations) => {
        this.translationsSignal.update((state) => ({ ...state, [locale]: translations }));
        this.loadedLocales.add(locale);
      })
      .catch(async () => {
        if (locale !== DEFAULT_LOCALE) {
          await this.loadTranslations(DEFAULT_LOCALE);
          this.loadedLocales.add(locale);
          return;
        }
        this.translationsSignal.update((state) => ({ ...state, [locale]: {} }));
        this.loadedLocales.add(locale);
      })
      .finally(() => {
        this.loadingLocales.delete(locale);
      });

    this.loadingLocales.set(locale, loading);
    await loading;
  }

  private async fetchTranslations(locale: AppLocale): Promise<TranslationDictionary> {
    const response = await fetch(`/i18n/${locale}.json`, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Failed to load locale ${locale}`);
    }

    const payload = (await response.json()) as unknown;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return {};
    }

    const entries = Object.entries(payload as Record<string, unknown>);
    return entries.reduce<TranslationDictionary>((acc, [key, value]) => {
      acc[key] = String(value ?? '');
      return acc;
    }, {});
  }
}
