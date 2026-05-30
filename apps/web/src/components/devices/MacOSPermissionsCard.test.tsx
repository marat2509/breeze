import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TCCPermissions } from '@breeze/shared';

import MacOSPermissionsCard from './MacOSPermissionsCard';

vi.mock('../../stores/auth', () => ({
  fetchWithAuth: vi.fn(),
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

describe('MacOSPermissionsCard localization', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      value: makeMemoryStorage(),
      writable: true,
      configurable: true,
    });
    window.localStorage.setItem('breeze_locale', 'ru');
    document.cookie = 'breeze_locale=; Max-Age=0; Path=/';
  });

  it('renders Russian permission labels, statuses, and warning copy', () => {
    const permissions: TCCPermissions = {
      fullDiskAccess: false,
      screenRecording: false,
      accessibility: true,
      remoteDesktop: null,
      checkedAt: '2026-05-30T12:00:00.000Z',
    };

    render(
      <MacOSPermissionsCard
        deviceId="device-1"
        tccPermissions={permissions}
        formatDate={() => '30.05.2026, 12:00'}
      />,
    );

    expect(screen.getByText('Разрешения macOS')).toBeInTheDocument();
    expect(screen.getByText('Полный доступ к диску')).toBeInTheDocument();
    expect(screen.getByText('Запись экрана')).toBeInTheDocument();
    expect(screen.getByText('Универсальный доступ')).toBeInTheDocument();
    expect(screen.getByText('Удалённый рабочий стол')).toBeInTheDocument();
    expect(screen.getAllByText('Отсутствует').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Разрешено')).toBeInTheDocument();
    expect(screen.getByText('Автоуправление через FDA')).toBeInTheDocument();
    expect(screen.getByText(/Полный доступ к диску нужно выдать/)).toBeInTheDocument();
    expect(screen.getByText('Последняя проверка: 30.05.2026, 12:00')).toBeInTheDocument();
  });
});
