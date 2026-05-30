import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getStoredLocale, persistLocalePreference } from './client';

function makeMemoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear() {
      data.clear();
    },
    getItem(key: string) {
      return data.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      data.set(key, String(value));
    },
    removeItem(key: string) {
      data.delete(key);
    },
    key(index: number) {
      return Array.from(data.keys())[index] ?? null;
    },
  };
}

describe('i18n client locale persistence', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      value: makeMemoryStorage(),
      writable: true,
      configurable: true,
    });
    document.cookie = 'breeze_locale=; Max-Age=0; Path=/';
    vi.restoreAllMocks();
  });

  it('reads locale from localStorage before navigator language', () => {
    window.localStorage.setItem('breeze_locale', 'ru');
    expect(getStoredLocale()).toBe('ru');
  });

  it('persists locale to localStorage and cookie', () => {
    persistLocalePreference('ru');
    expect(window.localStorage.getItem('breeze_locale')).toBe('ru');
    expect(document.cookie).toContain('breeze_locale=ru');
  });
});
