import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DeviceFilters from './DeviceFilters';

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

const baseProps = {
  sites: [{ id: 'site-1', name: 'HQ' }],
  availableTags: ['prod', 'edge'],
  onStatusChange: vi.fn(),
  onOsChange: vi.fn(),
  onRoleChange: vi.fn(),
  onSiteChange: vi.fn(),
  onTagsChange: vi.fn(),
  onClearAll: vi.fn(),
};

describe('DeviceFilters localization', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      value: makeMemoryStorage(),
      writable: true,
      configurable: true,
    });
    window.localStorage.setItem('breeze_locale', 'ru');
    document.cookie = 'breeze_locale=; Max-Age=0; Path=/';
    vi.clearAllMocks();
  });

  it('renders Russian labels in sidebar layout', () => {
    render(
      <DeviceFilters
        {...baseProps}
        statusFilter={['online']}
        osFilter={['windows']}
        roleFilter={['server']}
        siteFilter="site-1"
        tagsFilter={['prod']}
      />
    );

    expect(screen.getByText('Фильтры')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Очистить всё' })).toBeDefined();
    expect(screen.getByText('Статус')).toBeDefined();
    expect(screen.getAllByText('В сети').length).toBeGreaterThan(0);
    expect(screen.getByText('Операционная система')).toBeDefined();
    expect(screen.getByText('Роль устройства')).toBeDefined();
    expect(screen.getAllByText('Сервер').length).toBeGreaterThan(0);
    expect(screen.getByText('Сайт')).toBeDefined();
    expect(screen.getByRole('option', { name: 'Все сайты' })).toBeDefined();
    expect(screen.getByText('Теги')).toBeDefined();
    expect(screen.getByText('Активные фильтры:')).toBeDefined();
  });

  it('renders Russian labels in header layout', () => {
    render(
      <DeviceFilters
        {...baseProps}
        layout="header"
        statusFilter={['offline']}
        osFilter={[]}
        roleFilter={[]}
        siteFilter={null}
        tagsFilter={[]}
      />
    );

    expect(screen.getByText('Статус')).toBeDefined();
    expect(screen.getByText('Тип ОС')).toBeDefined();
    expect(screen.getByText('Роль устройства')).toBeDefined();
    expect(screen.getByRole('option', { name: 'Все сайты' })).toBeDefined();
    expect(screen.getByText('Теги')).toBeDefined();
    expect(screen.getByRole('button', { name: /Очистить фильтры/ })).toBeDefined();
  });
});
