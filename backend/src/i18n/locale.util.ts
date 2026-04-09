import { DEFAULT_LOCALE, AppLocale, isSupportedLocale } from './locale.types';

export function resolveLocaleFromHeaders(headers: Record<string, unknown>): AppLocale {
  const raw =
    (headers['x-locale'] as string | undefined) ??
    (headers['accept-language'] as string | undefined) ??
    '';
  const normalized = raw.toLowerCase();

  const parts = normalized
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .map((item) => item.split(';')[0]?.trim() ?? '')
    .map((item) => item.split('-')[0]?.trim() ?? '');

  const found = parts.find((part) => isSupportedLocale(part));
  return found ?? DEFAULT_LOCALE;
}
