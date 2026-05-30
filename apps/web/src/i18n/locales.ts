export const SUPPORTED_LOCALES = ['en', 'ru'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_COOKIE_NAME = 'breeze_locale';
export const LOCALE_STORAGE_KEY = LOCALE_COOKIE_NAME;

const LOCALE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function isSupportedLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function normalizeLocale(value: unknown): Locale | null {
  if (isSupportedLocale(value)) return value;
  if (typeof value !== 'string') return null;
  const base = value.toLowerCase().split(/[-_]/)[0];
  return isSupportedLocale(base) ? base : null;
}

function readCookieFromHeader(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  const target = `${name}=`;
  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim();
    if (trimmed.startsWith(target)) {
      return decodeURIComponent(trimmed.slice(target.length));
    }
  }
  return null;
}

export function resolveLocaleFromHeaders(headers: Headers): Locale {
  const cookieLocale = normalizeLocale(readCookieFromHeader(headers.get('cookie'), LOCALE_COOKIE_NAME));
  if (cookieLocale) return cookieLocale;

  const acceptLanguage = headers.get('accept-language');
  if (acceptLanguage) {
    const candidates = acceptLanguage
      .split(',')
      .map((entry) => entry.trim().split(';')[0])
      .filter(Boolean);
    for (const candidate of candidates) {
      const locale = normalizeLocale(candidate);
      if (locale) return locale;
    }
  }

  return DEFAULT_LOCALE;
}

export function resolveLocaleFromRequest(request: Request): Locale {
  return resolveLocaleFromHeaders(request.headers);
}

export function createLocaleCookie(locale: Locale): string {
  return `${LOCALE_COOKIE_NAME}=${encodeURIComponent(locale)}; Path=/; Max-Age=${LOCALE_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
}

export function getLocaleDisplayName(locale: Locale, displayLocale: Locale): string {
  if (displayLocale === 'ru') {
    return locale === 'ru' ? 'Русский' : 'Английский';
  }
  return locale === 'ru' ? 'Russian' : 'English';
}
