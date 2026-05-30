import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  SUPPORTED_LOCALES,
  createLocaleCookie,
  getLocaleDisplayName,
  isSupportedLocale,
  resolveLocaleFromHeaders,
} from './locales';

describe('i18n locale contracts', () => {
  it('defines English as default and Russian as supported', () => {
    expect(DEFAULT_LOCALE).toBe('en');
    expect(SUPPORTED_LOCALES).toEqual(['en', 'ru']);
    expect(isSupportedLocale('en')).toBe(true);
    expect(isSupportedLocale('ru')).toBe(true);
    expect(isSupportedLocale('de')).toBe(false);
  });

  it('uses cookie locale before Accept-Language', () => {
    const headers = new Headers({
      cookie: `${LOCALE_COOKIE_NAME}=ru`,
      'accept-language': 'en-US,en;q=0.9',
    });

    expect(resolveLocaleFromHeaders(headers)).toBe('ru');
  });

  it('falls back to Accept-Language and then English', () => {
    expect(resolveLocaleFromHeaders(new Headers({ 'accept-language': 'ru-RU,ru;q=0.9,en;q=0.4' }))).toBe('ru');
    expect(resolveLocaleFromHeaders(new Headers({ 'accept-language': 'de-DE,de;q=0.9' }))).toBe('en');
  });

  it('creates a durable same-site locale cookie', () => {
    expect(createLocaleCookie('ru')).toContain(`${LOCALE_COOKIE_NAME}=ru`);
    expect(createLocaleCookie('ru')).toContain('Max-Age=');
    expect(createLocaleCookie('ru')).toContain('SameSite=Lax');
    expect(createLocaleCookie('ru')).toContain('Path=/');
  });

  it('returns translated locale display names', () => {
    expect(getLocaleDisplayName('en', 'ru')).toBe('Английский');
    expect(getLocaleDisplayName('ru', 'ru')).toBe('Русский');
    expect(getLocaleDisplayName('ru', 'en')).toBe('Russian');
  });
});
