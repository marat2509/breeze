import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SavedFilterList } from './SavedFilterList';
import { fetchWithAuth } from '../../stores/auth';

vi.mock('../../stores/auth', () => ({
  fetchWithAuth: vi.fn(),
}));

const fetchWithAuthMock = vi.mocked(fetchWithAuth);

const makeJsonResponse = (payload: unknown): Response =>
  ({
    ok: true,
    json: vi.fn().mockResolvedValue(payload),
  }) as unknown as Response;

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

describe('SavedFilterList localization', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      value: makeMemoryStorage(),
      writable: true,
      configurable: true,
    });
    window.localStorage.setItem('breeze_locale', 'ru');
    document.cookie = 'breeze_locale=; Max-Age=0; Path=/';
    fetchWithAuthMock.mockResolvedValue(makeJsonResponse({ data: [] }));
  });

  it('renders Russian labels for empty saved filters', async () => {
    render(<SavedFilterList />);

    expect(await screen.findByText('Сохранённые фильтры')).toBeDefined();
    expect(screen.getByRole('button', { name: /Новый фильтр/ })).toBeDefined();
    expect(screen.getByPlaceholderText('Поиск фильтров...')).toBeDefined();
    expect(screen.getByText('Сохранённых фильтров пока нет. Создайте фильтр, чтобы переиспользовать его в группах и развёртываниях.')).toBeDefined();
    expect(screen.getByRole('button', { name: /Создать первый фильтр/ })).toBeDefined();
  });

  it('renders Russian labels in the create form', async () => {
    render(<SavedFilterList />);

    fireEvent.click(await screen.findByRole('button', { name: /Новый фильтр/ }));

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Создать фильтр' })).toBeDefined());
    expect(screen.getByText('Название')).toBeDefined();
    expect(screen.getByPlaceholderText('например, Windows-серверы')).toBeDefined();
    expect(screen.getByText('Описание (необязательно)')).toBeDefined();
    expect(screen.getByPlaceholderText('Опишите, какие устройства находит этот фильтр')).toBeDefined();
    expect(screen.getByText('Условия')).toBeDefined();
    expect(screen.getAllByRole('button', { name: 'Отмена' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Создать фильтр' })).toBeDefined();
  });
});
