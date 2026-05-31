import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DeviceMetricsChart from './DeviceMetricsChart';
import { fetchWithAuth } from '../../stores/auth';

vi.mock('../../stores/auth', () => ({
  fetchWithAuth: vi.fn(),
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children?: ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  LineChart: ({ children }: { children?: ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  ),
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

function makeJsonResponse(payload: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue(payload),
  } as unknown as Response;
}

describe('DeviceMetricsChart localization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'localStorage', {
      value: makeMemoryStorage(),
      writable: true,
      configurable: true,
    });
    window.localStorage.setItem('breeze_locale', 'ru');
    document.cookie = 'breeze_locale=; Max-Age=0; Path=/';
  });

  it('renders Russian metric chart labels and summary cards', async () => {
    fetchWithAuthMock.mockResolvedValue(makeJsonResponse({
      metrics: [
        {
          timestamp: '2026-05-30T10:00:00.000Z',
          cpu: 20,
          ram: 40,
          disk: 70.5,
        },
        {
          timestamp: '2026-05-30T10:05:00.000Z',
          cpu: 30,
          ram: 50,
          disk: 72.5,
        },
      ],
    }));

    render(<DeviceMetricsChart deviceId="device-1" />);

    expect(await screen.findByText('Метрики производительности')).toBeInTheDocument();
    expect(screen.getByText('Использование системных ресурсов в реальном времени')).toBeInTheDocument();
    expect(screen.getByText('Последний час')).toBeInTheDocument();
    expect(screen.getByText('Последние 24 часа')).toBeInTheDocument();
    expect(screen.getAllByText('CPU').length).toBeGreaterThan(0);
    expect(screen.getAllByText('RAM').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Диск').length).toBeGreaterThan(0);
    expect(screen.getAllByText('текущее').length).toBe(3);
    expect(screen.getAllByText(/Среднее:/).length).toBe(3);
    expect(screen.getAllByText(/Макс:/).length).toBe(3);
  });
});
