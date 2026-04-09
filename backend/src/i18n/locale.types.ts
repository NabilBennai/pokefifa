export const SUPPORTED_LOCALES = ['en', 'fr', 'es'] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = 'en';

export function isSupportedLocale(value: string | null | undefined): value is AppLocale {
  if (!value) {
    return false;
  }
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}
