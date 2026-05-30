import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DeviceSettingsModal from './DeviceSettingsModal';
import type { Device } from './DeviceList';
import { fetchWithAuth } from '../../stores/auth';

vi.mock('../../stores/auth', () => ({
  fetchWithAuth: vi.fn(),
}));

const fetchWithAuthMock = vi.mocked(fetchWithAuth);

const makeJsonResponse = (payload: unknown, ok = true, status = ok ? 200 : 500): Response =>
  ({
    ok,
    status,
    statusText: ok ? 'OK' : 'ERROR',
    json: vi.fn().mockResolvedValue(payload),
  }) as unknown as Response;

const baseDevice: Device = {
  id: 'device-1',
  hostname: 'edge-01',
  displayName: 'Edge 01',
  os: 'windows',
  osVersion: '11',
  status: 'online',
  cpuPercent: 58,
  ramPercent: 71,
  lastSeen: '2026-02-09T10:00:00.000Z',
  orgId: 'org-1',
  orgName: 'Org One',
  siteId: 'site-1',
  siteName: 'HQ',
  agentVersion: '1.0.0',
  tags: ['edge'],
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

describe('DeviceSettingsModal localization', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      value: makeMemoryStorage(),
      writable: true,
      configurable: true,
    });
    window.localStorage.setItem('breeze_locale', 'ru');
    document.cookie = 'breeze_locale=; Max-Age=0; Path=/';
    vi.clearAllMocks();
    fetchWithAuthMock.mockResolvedValue(makeJsonResponse({ data: [{ id: 'site-1', name: 'HQ' }] }));
  });

  it('renders Russian settings controls for an active device', () => {
    render(
      <DeviceSettingsModal
        device={baseDevice}
        isOpen
        onClose={vi.fn()}
        onSaved={vi.fn()}
        onAction={vi.fn()}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Настройки устройства' })).toBeDefined();
    expect(screen.getByLabelText('Отображаемое имя')).toBeDefined();
    expect(screen.getByLabelText('Сайт')).toBeDefined();
    expect(screen.getByText('Теги')).toBeDefined();
    expect(screen.getByPlaceholderText('Добавить тег...')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Добавить' })).toBeDefined();
    expect(screen.getByText('Зона риска')).toBeDefined();
    expect(screen.getByText('Вывод из эксплуатации удалит устройство из активного парка.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Вывести устройство из эксплуатации' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Отмена' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Сохранить изменения' })).toBeDefined();
  });

  it('renders Russian actions for a decommissioned device', () => {
    render(
      <DeviceSettingsModal
        device={{ ...baseDevice, status: 'decommissioned' }}
        isOpen
        onClose={vi.fn()}
        onSaved={vi.fn()}
        onAction={vi.fn()}
      />,
    );

    expect(screen.getByText('Устройство выведено из эксплуатации')).toBeDefined();
    expect(screen.getByText('Устройство выведено из эксплуатации. Его можно восстановить или удалить безвозвратно.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Восстановить устройство' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Удалить безвозвратно' })).toBeDefined();
  });
});
