import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DeploymentTargetConfig } from '@breeze/shared';

import { DeviceTargetSelector } from './DeviceTargetSelector';

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

const allTargets: DeploymentTargetConfig = { type: 'all' };

describe('DeviceTargetSelector localization', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      value: makeMemoryStorage(),
      writable: true,
      configurable: true,
    });
    window.localStorage.setItem('breeze_locale', 'ru');
    document.cookie = 'breeze_locale=; Max-Age=0; Path=/';
  });

  it('renders Russian target mode labels and counts', () => {
    render(
      <DeviceTargetSelector
        value={allTargets}
        onChange={vi.fn()}
        sites={[]}
        groups={[{ id: 'group-1', name: 'Servers', deviceCount: 2 }]}
        devices={[
          { id: 'device-1', hostname: 'srv-01', os: 'windows', status: 'online' },
          { id: 'device-2', hostname: 'mac-01', os: 'macos', status: 'offline' },
        ]}
        showSavedFilters={false}
        showPreview={false}
      />
    );

    expect(screen.getByRole('button', { name: /Все устройства/ })).toBeDefined();
    expect(screen.getByRole('button', { name: /Выбрать устройства/ })).toBeDefined();
    expect(screen.getByRole('button', { name: /Группы устройств/ })).toBeDefined();
    expect(screen.getByRole('button', { name: /Расширенный фильтр/ })).toBeDefined();
    expect(screen.getByText('Цель: все управляемые устройства')).toBeDefined();
    expect(screen.getByText('2 устройства всего')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: /Выбрать устройства/ }));
    expect(screen.getByText('0 устройств выбрано')).toBeDefined();
    expect(screen.getByPlaceholderText('Поиск устройств...')).toBeDefined();
    expect(screen.getByText('В сети')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: /Группы устройств/ }));
    expect(screen.getByText('0 групп выбрано')).toBeDefined();
    expect(screen.getByText('(2 устройства)')).toBeDefined();
  });
});
