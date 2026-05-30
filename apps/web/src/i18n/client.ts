import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  LOCALE_STORAGE_KEY,
  createLocaleCookie,
  normalizeLocale,
  type Locale,
} from './locales';

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const target = `${name}=`;
  for (const part of document.cookie.split(';')) {
    const trimmed = part.trim();
    if (trimmed.startsWith(target)) {
      return decodeURIComponent(trimmed.slice(target.length));
    }
  }
  return null;
}

export function getStoredLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;

  const localStorageLocale = normalizeLocale(window.localStorage.getItem(LOCALE_STORAGE_KEY));
  if (localStorageLocale) return localStorageLocale;

  const cookieLocale = normalizeLocale(readCookie(LOCALE_COOKIE_NAME));
  if (cookieLocale) return cookieLocale;

  const navigatorLocale = normalizeLocale(window.navigator.language);
  return navigatorLocale ?? DEFAULT_LOCALE;
}

export function persistLocalePreference(locale: Locale): void {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }
  if (typeof document !== 'undefined') {
    document.cookie = createLocaleCookie(locale);
  }
}

export function syncLocaleFromPreference(locale: unknown): Locale {
  const normalized = normalizeLocale(locale);
  if (normalized) {
    persistLocalePreference(normalized);
    return normalized;
  }
  return getStoredLocale();
}
