import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DeviceCompare from './DeviceCompare';
import { fetchWithAuth } from '@/stores/auth';

vi.mock('@/stores/auth', () => ({
  fetchWithAuth: vi.fn(),
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children?: ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  LineChart: ({ children }: { children?: ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Line: ({ name }: { name?: string }) => <div data-testid="chart-line">{name}</div>,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
}));

const fetchWithAuthMock = vi.mocked(fetchWithAuth);

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

function makeJsonResponse(payload: unknown, ok = true, status = ok ? 200 : 500): Response {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'ERROR',
    json: vi.fn().mockResolvedValue(payload),
  } as unknown as Response;
}

const devices = [
  {
    id: 'device-1',
    hostname: 'alpha',
    osType: 'windows',
    osVersion: '11',
    status: 'online',
    cpuPercent: 12,
    ramPercent: 34,
    siteId: 'site-1',
    siteName: 'HQ',
    agentVersion: '1.0.0',
  },
  {
    id: 'device-2',
    hostname: 'beta',
    osType: 'linux',
    osVersion: 'Ubuntu 24.04',
    status: 'maintenance',
    cpuPercent: 22,
    ramPercent: 44,
    siteId: 'site-1',
    siteName: 'HQ',
    agentVersion: '1.0.1',
  },
];

const detailsById: Record<string, unknown> = {
  'device-1': {
    ...devices[0],
    hardware: { cpuModel: 'Intel Core', totalRam: '16 GB', diskTotal: '512 GB' },
    software: [{ name: 'Chrome' }, { name: 'Zoom' }],
    patches: [{ id: 'patch-1', name: 'KB5000001', status: 'installed' }],
    config: { timezone: 'UTC' },
    metrics: [{ timestamp: '2026-05-30T10:00:00.000Z', cpu: 12, ram: 34, disk: 45 }],
  },
  'device-2': {
    ...devices[1],
    hardware: { cpuModel: 'AMD Ryzen', totalRam: '32 GB', diskTotal: '1 TB' },
    software: [{ name: 'Chrome' }],
    patches: [{ id: 'patch-1', name: 'KB5000001', status: 'missing' }],
    config: { timezone: 'Europe/Minsk' },
    metrics: [{ timestamp: '2026-05-30T10:00:00.000Z', cpu: 22, ram: 44, disk: 55 }],
  },
};

describe('DeviceCompare localization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'localStorage', {
      value: makeMemoryStorage(),
      writable: true,
      configurable: true,
    });
    window.localStorage.setItem('breeze_locale', 'ru');
    document.cookie = 'breeze_locale=; Max-Age=0; Path=/';
    window.history.replaceState({}, '', '/devices/compare');
    fetchWithAuthMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url === '/devices') return makeJsonResponse({ data: devices });
      const detailMatch = url.match(/^\/devices\/(.+)$/);
      if (detailMatch) return makeJsonResponse(detailsById[detailMatch[1]]);
      throw new Error(`Unexpected request: ${url}`);
    });
  });

  it('renders Russian comparison controls and dense sections', async () => {
    render(<DeviceCompare timezone="UTC" />);

    expect(await screen.findByText('Сравнение устройств')).toBeInTheDocument();
    expect(screen.getByText('Сравните оборудование, ПО, патчи и конфигурацию по парку устройств.')).toBeInTheDocument();
    expect(screen.getByText('Экспорт PDF')).toBeInTheDocument();
    expect(screen.getByText('Экспорт CSV')).toBeInTheDocument();
    expect(screen.getByText('Поделиться')).toBeInTheDocument();
    expect(screen.getByText('Выберите устройства (2-4)')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Поиск по hostname')).toBeInTheDocument();
    expect(screen.getByText('Выбранные устройства')).toBeInTheDocument();
    expect(await screen.findByText('Готово к сравнению: 2 устройства.')).toBeInTheDocument();
    expect(screen.getByText('Онлайн')).toBeInTheDocument();
    expect(screen.getByText('Обслуживание')).toBeInTheDocument();
    expect(await screen.findByText('Краткая сводка характеристик')).toBeInTheDocument();
    expect(screen.getByText('Сравнение ПО')).toBeInTheDocument();
    expect(screen.getByText('Общее ПО')).toBeInTheDocument();
    expect(screen.getByText('Сравнение статуса патчей')).toBeInTheDocument();
    expect(screen.getByText('Сравнение конфигурации')).toBeInTheDocument();
    expect(screen.getByText('Сравнение производительности')).toBeInTheDocument();
  });
});
