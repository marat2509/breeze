import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DevicePerformanceGraphs from './DevicePerformanceGraphs';
import { fetchWithAuth } from '../../stores/auth';

vi.mock('../../stores/auth', () => ({
  fetchWithAuth: vi.fn(),
}));

vi.mock('recharts', () => {
  const visibleChartChildren = (children?: ReactNode) => {
    const items = Array.isArray(children) ? children : [children];
    return items.filter((child) => !(child && typeof child === 'object' && 'type' in child && child.type === 'defs'));
  };

  return {
    ResponsiveContainer: ({ children }: { children?: ReactNode }) => (
      <div data-testid="responsive-container">{children}</div>
    ),
    LineChart: ({ children }: { children?: ReactNode }) => <div data-testid="line-chart">{children}</div>,
    Line: ({ name }: { name?: string }) => <div data-testid="chart-line">{name}</div>,
    AreaChart: ({ children }: { children?: ReactNode }) => (
      <div data-testid="area-chart">{visibleChartChildren(children)}</div>
    ),
    Area: ({ name }: { name?: string }) => <div data-testid="chart-area">{name}</div>,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    Legend: () => null,
  };
});

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

describe('DevicePerformanceGraphs localization', () => {
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

  it('renders Russian chart titles, legends, and latest metric labels', async () => {
    fetchWithAuthMock.mockResolvedValue(makeJsonResponse({
      data: [
        {
          timestamp: '2026-05-30T10:00:00.000Z',
          cpu: 22,
          ram: 45,
          disk: 67,
          diskActivityAvailable: true,
          diskReadBps: 2048,
          diskWriteBps: 4096,
          diskReadOps: 12,
          diskWriteOps: 8,
          bandwidthInBps: 1_250_000,
          bandwidthOutBps: 625_000,
        },
      ],
    }));

    render(<DevicePerformanceGraphs deviceId="device-1" />);

    expect(await screen.findByText('Графики производительности')).toBeInTheDocument();
    expect(screen.getByText('CPU, RAM, диск и сетевой трафик во времени')).toBeInTheDocument();
    expect(screen.getByText('24 ч')).toBeInTheDocument();
    expect(screen.getAllByText('CPU').length).toBeGreaterThan(0);
    expect(screen.getAllByText('RAM').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Диск').length).toBeGreaterThan(0);
    expect(screen.getByText('CPU (последнее)')).toBeInTheDocument();
    expect(screen.getByText('RAM (последнее)')).toBeInTheDocument();
    expect(screen.getByText('Диск (последнее)')).toBeInTheDocument();
    expect(screen.getByText('Сетевой трафик')).toBeInTheDocument();
    expect(screen.getAllByText('Скачивание').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Отдача').length).toBeGreaterThan(0);
    expect(screen.getByText('Скачивание (последнее)')).toBeInTheDocument();
    expect(screen.getByText('Отдача (последнее)')).toBeInTheDocument();
    expect(screen.getByText('Активность диска')).toBeInTheDocument();
    expect(screen.getAllByText('Скорость чтения').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Скорость записи').length).toBeGreaterThan(0);
    expect(screen.getByText('Операции чтения (последнее)')).toBeInTheDocument();
    expect(screen.getByText('Операции записи (последнее)')).toBeInTheDocument();
  });
});
