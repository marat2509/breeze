import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FilterConditionGroup } from '@breeze/shared';

import { DeviceFilterBar } from './DeviceFilterBar';
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

const oneCondition: FilterConditionGroup = {
  operator: 'AND',
  conditions: [{ field: 'hostname', operator: 'contains', value: 'edge' }],
};

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

describe('DeviceFilterBar localization', () => {
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

  it('renders Russian labels for collapsed filter controls', () => {
    render(<DeviceFilterBar value={oneCondition} onChange={vi.fn()} />);

    expect(screen.getByRole('option', { name: 'Сохранённые фильтры...' })).toBeDefined();
    expect(screen.getByText('1 условие активно')).toBeDefined();
    expect(screen.getByRole('button', { name: /Очистить/ })).toBeDefined();
    expect(screen.getByRole('button', { name: /Расширенный фильтр/ })).toBeDefined();
  });

  it('renders Russian collapse label when expanded', () => {
    render(
      <DeviceFilterBar
        value={oneCondition}
        onChange={vi.fn()}
        showSavedFilters={false}
        defaultExpanded
      />
    );

    expect(screen.getByRole('button', { name: /Свернуть/ })).toBeDefined();
  });
});
