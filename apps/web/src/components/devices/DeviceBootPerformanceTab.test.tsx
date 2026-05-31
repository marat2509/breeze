import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DeviceBootPerformanceTab from './DeviceBootPerformanceTab';
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
    AreaChart: ({ children }: { children?: ReactNode }) => (
      <div data-testid="area-chart">{visibleChartChildren(children)}</div>
    ),
    Area: ({ name }: { name?: string }) => <div data-testid="chart-area">{name}</div>,
    LineChart: ({ children }: { children?: ReactNode }) => <div data-testid="line-chart">{children}</div>,
    Line: ({ name }: { name?: string }) => <div data-testid="chart-line">{name}</div>,
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

describe('DeviceBootPerformanceTab localization', () => {
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

  it('renders Russian boot metrics, chart labels, startup table, and history labels', async () => {
    fetchWithAuthMock.mockResolvedValue(makeJsonResponse({
      summary: {
        totalBoots: 2,
        avgBootTimeSeconds: 62.5,
        fastestBootSeconds: 45.2,
        slowestBootSeconds: 80,
      },
      boots: [
        {
          id: 'boot-1',
          bootTimestamp: '2026-05-30T10:00:00.000Z',
          biosSeconds: 5,
          osLoaderSeconds: 20,
          desktopReadySeconds: 37.5,
          totalBootSeconds: 62.5,
          startupItemCount: 1,
          startupItems: [
            {
              itemId: 'startup-1',
              name: 'Patch Updater',
              type: 'scheduled_task',
              path: 'C:\\Program Files\\Breeze\\patch-updater.exe',
              enabled: false,
              cpuTimeMs: 100,
              diskIoBytes: 2048,
              impactScore: 72,
            },
          ],
        },
      ],
    }));

    render(<DeviceBootPerformanceTab deviceId="device-1" timezone="UTC" />);

    expect(await screen.findByText('Производительность загрузки')).toBeInTheDocument();
    expect(screen.getByText('Тренды времени загрузки, разбивка по фазам и анализ элементов автозагрузки.')).toBeInTheDocument();
    expect(screen.getByText('Обновить')).toBeInTheDocument();
    expect(screen.getByText('Собрать сейчас')).toBeInTheDocument();
    expect(screen.getByText('Среднее время загрузки')).toBeInTheDocument();
    expect(screen.getByText('Самая быстрая загрузка')).toBeInTheDocument();
    expect(screen.getByText('Самая медленная загрузка')).toBeInTheDocument();
    expect(screen.getByText('Загрузок отслежено')).toBeInTheDocument();
    expect(screen.getByText('Тренд времени загрузки')).toBeInTheDocument();
    expect(screen.getAllByText('Загрузчик ОС').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Рабочий стол готов').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Всего').length).toBeGreaterThan(0);
    expect(screen.getByText('Элементы автозагрузки (последняя загрузка)')).toBeInTheDocument();
    expect(screen.getAllByText('Имя').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Тип').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Статус').length).toBeGreaterThan(0);
    expect(screen.getByText('Время CPU')).toBeInTheDocument();
    expect(screen.getByText('Дисковый I/O')).toBeInTheDocument();
    expect(screen.getByText('Влияние')).toBeInTheDocument();
    expect(screen.getByText('Patch Updater')).toBeInTheDocument();
    expect(screen.getByText('Запланированная задача')).toBeInTheDocument();
    expect(screen.getByText('Отключено')).toBeInTheDocument();
    expect(screen.getByText('История загрузок')).toBeInTheDocument();
    expect(screen.getByText('Время')).toBeInTheDocument();
    expect(screen.getByText('Общее время')).toBeInTheDocument();
    expect(screen.getAllByText('Элементы автозагрузки').length).toBeGreaterThan(0);
  });
});
