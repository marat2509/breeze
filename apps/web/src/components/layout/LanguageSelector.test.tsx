import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LanguageSelector from './LanguageSelector';

vi.mock('../../stores/auth', () => ({
  fetchWithAuth: vi.fn().mockResolvedValue({ ok: true }),
  useAuthStore: vi.fn((selector: (state: unknown) => unknown) =>
    selector({
      isAuthenticated: true,
      user: { preferences: { theme: 'system', locale: 'en' } },
    }),
  ),
}));

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

describe('LanguageSelector', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      value: makeMemoryStorage(),
      writable: true,
      configurable: true,
    });
    document.cookie = 'breeze_locale=; Max-Age=0; Path=/';
    vi.clearAllMocks();
  });

  it('switches to Russian and persists the choice', async () => {
    render(<LanguageSelector locale="en" />);

    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'ru' } });

    await waitFor(() => {
      expect(window.localStorage.getItem('breeze_locale')).toBe('ru');
      expect(document.cookie).toContain('breeze_locale=ru');
    });
  });
});
