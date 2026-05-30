import { useEffect, useMemo, useState } from 'react';
import { getStoredLocale, persistLocalePreference } from './client';
import { DEFAULT_LOCALE, normalizeLocale, type Locale } from './locales';
import { translate, type TranslationParams } from './resources';

const LOCALE_CHANGE_EVENT = 'breeze:locale-change';

export function emitLocaleChange(locale: Locale): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(LOCALE_CHANGE_EVENT, { detail: { locale } }));
}

export function useLocale(initialLocale?: Locale): [Locale, (locale: Locale) => void] {
  const [locale, setLocaleState] = useState<Locale>(initialLocale ?? DEFAULT_LOCALE);

  useEffect(() => {
    setLocaleState(initialLocale ?? getStoredLocale());
  }, [initialLocale]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (event: Event) => {
      const next = normalizeLocale((event as CustomEvent<{ locale?: unknown }>).detail?.locale);
      if (next) setLocaleState(next);
    };
    window.addEventListener(LOCALE_CHANGE_EVENT, handler);
    return () => window.removeEventListener(LOCALE_CHANGE_EVENT, handler);
  }, []);

  const setLocale = (next: Locale) => {
    persistLocalePreference(next);
    setLocaleState(next);
    emitLocaleChange(next);
  };

  return [locale, setLocale];
}

export function useI18n(initialLocale?: Locale) {
  const [locale, setLocale] = useLocale(initialLocale);
  return useMemo(
    () => ({
      locale,
      setLocale,
      t: (key: string, params?: TranslationParams, fallback?: string) =>
        translate(locale, key, params, fallback),
    }),
    [locale, setLocale],
  );
}
