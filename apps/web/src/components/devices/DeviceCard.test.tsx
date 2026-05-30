import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DeviceCard from './DeviceCard';
import type { Device } from './DeviceList';
import { fetchWithAuth } from '../../stores/auth';

vi.mock('../../stores/auth', () => ({
  fetchWithAuth: vi.fn()
}));

const fetchWithAuthMock = vi.mocked(fetchWithAuth);

const makeJsonResponse = (payload: unknown, ok = true, status = ok ? 200 : 500): Response =>
  ({
    ok,
    status,
    statusText: ok ? 'OK' : 'ERROR',
    json: vi.fn().mockResolvedValue(payload)
  }) as unknown as Response;

const baseDevice: Device = {
  id: 'device-1',
  hostname: 'edge-01',
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
  tags: []
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

describe('DeviceCard sparkline history', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      value: makeMemoryStorage(),
      writable: true,
      configurable: true,
    });
    window.localStorage.clear();
    document.cookie = 'breeze_locale=; Max-Age=0; Path=/';
    vi.clearAllMocks();
  });

  it('renders CPU/RAM sparklines from metrics API data', async () => {
    fetchWithAuthMock.mockResolvedValueOnce(
      makeJsonResponse({
        metrics: [
          { timestamp: '2026-02-09T10:00:00.000Z', cpu: 40, ram: 50 },
          { timestamp: '2026-02-09T10:05:00.000Z', cpu: 45, ram: 55 },
          { timestamp: '2026-02-09T10:10:00.000Z', cpu: 52, ram: 63 }
        ]
      })
    );

    render(<DeviceCard device={baseDevice} />);

    await screen.findByTestId('cpu-sparkline-device-1');
    expect(screen.queryByText('Loading trend...')).toBeNull();
    expect(screen.queryByText('No trend data')).toBeNull();

    await screen.findByTestId('ram-sparkline-device-1');

    expect(fetchWithAuthMock).toHaveBeenCalledWith('/devices/device-1/metrics?range=1h');
  });

  it('shows an explicit empty state when no metric history exists', async () => {
    fetchWithAuthMock.mockResolvedValueOnce(makeJsonResponse({ metrics: [] }));

    render(<DeviceCard device={baseDevice} />);

    await waitFor(() => {
      expect(screen.getAllByText('No trend data').length).toBe(2);
    });
  });

  it('renders Russian empty trend and action labels from the selected locale', async () => {
    fetchWithAuthMock.mockResolvedValueOnce(makeJsonResponse({ metrics: [] }));
    window.localStorage.setItem('breeze_locale', 'ru');

    render(<DeviceCard device={baseDevice} />);

    await waitFor(() => {
      expect(screen.getAllByText('Нет данных тренда').length).toBe(2);
    });

    fireEvent.click(screen.getByLabelText('Действия для edge-01'));

    expect(screen.getByText('Удалённый терминал')).toBeDefined();
    expect(screen.getByText('Запустить скрипт')).toBeDefined();
    expect(screen.getByText('Перезагрузка')).toBeDefined();
    expect(screen.getByText('Настройки')).toBeDefined();
    expect(screen.getByText('Вывести из эксплуатации')).toBeDefined();
  });
});
