import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FilterConditionGroup } from '@breeze/shared';

import { FilterBuilder } from './FilterBuilder';
import { FilterPreview } from './FilterPreview';

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

const simpleFilter: FilterConditionGroup = {
  operator: 'AND',
  conditions: [{ field: 'hostname', operator: 'contains', value: '' }],
};

const nestedFilter: FilterConditionGroup = {
  operator: 'AND',
  conditions: [
    {
      operator: 'OR',
      conditions: [{ field: 'status', operator: 'equals', value: 'online' }],
    },
  ],
};

describe('FilterBuilder localization', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      value: makeMemoryStorage(),
      writable: true,
      configurable: true,
    });
    window.localStorage.setItem('breeze_locale', 'ru');
    document.cookie = 'breeze_locale=; Max-Age=0; Path=/';
  });

  it('renders Russian labels for the base builder controls', () => {
    render(<FilterBuilder value={simpleFilter} onChange={vi.fn()} showPreview={false} />);

    expect(screen.getByText('Совпадение')).toBeDefined();
    expect(screen.getByRole('option', { name: 'Все условия (AND)' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Добавить условие' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Добавить группу' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Имя хоста' })).toBeDefined();
    expect(screen.getByRole('option', { name: 'содержит' })).toBeDefined();
    expect(screen.getByPlaceholderText('например, srv-web-01')).toBeDefined();
    expect(screen.getByTitle('Удалить условие')).toBeDefined();
  });

  it('renders Russian labels for nested condition groups', () => {
    render(<FilterBuilder value={nestedFilter} onChange={vi.fn()} showPreview={false} />);

    expect(screen.getByText('Группа: совпадение')).toBeDefined();
    expect(screen.getByRole('option', { name: 'Любое (OR)' })).toBeDefined();
    expect(screen.getByText('1 условие')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Условие' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Группа' })).toBeDefined();
    expect(screen.getByTitle('Удалить группу')).toBeDefined();
  });

  it('renders Russian preview empty state', () => {
    render(<FilterPreview preview={null} loading={false} error={null} onRefresh={vi.fn()} />);

    expect(screen.getByText('Подходящие устройства')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Обновить' })).toBeDefined();
    expect(screen.getByText('Добавьте условия фильтра, чтобы увидеть подходящие устройства')).toBeDefined();
  });
});
