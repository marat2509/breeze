import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DeviceEventLogViewer from './DeviceEventLogViewer';
import { fetchWithAuth } from '../../stores/auth';

vi.mock('../../stores/auth', () => ({
  fetchWithAuth: vi.fn(),
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

describe('DeviceEventLogViewer localization', () => {
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

  it('renders Russian activity filters, badges, and expanded detail labels', async () => {
    fetchWithAuthMock.mockResolvedValue(makeJsonResponse({
      data: [
        {
          id: 'activity-1',
          timestamp: '2026-05-30T10:00:00.000Z',
          action: 'script.run',
          message: 'Script run failed',
          category: 'script',
          result: 'failure',
          actor: {
            type: 'user',
            name: 'NOC Operator',
            email: 'noc@example.test',
          },
          resource: {
            type: 'script',
            id: 'script-1',
            name: 'Patch Cleanup',
          },
          initiatedBy: 'ai',
          details: { commandId: 'cmd-1' },
          errorMessage: 'Exit code 1',
          ipAddress: '192.0.2.10',
        },
      ],
      pagination: { page: 1, limit: 50, total: 1 },
    }));

    render(<DeviceEventLogViewer deviceId="device-1" timezone="UTC" />);

    expect(await screen.findByText('Активности')).toBeInTheDocument();
    expect(screen.getByText('(1 всего)')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Поиск активностей...')).toBeInTheDocument();
    expect(screen.getByText('Все категории')).toBeInTheDocument();
    expect(screen.getByText('Все источники')).toBeInTheDocument();
    expect(screen.getByText('Все')).toBeInTheDocument();
    expect(screen.getByText('Успешно')).toBeInTheDocument();
    expect(screen.getAllByText('С ошибкой').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Скрипт').length).toBeGreaterThan(0);
    expect(screen.getByText('Script run failed')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Script run failed'));

    expect(await screen.findByText('Действие')).toBeInTheDocument();
    expect(screen.getByText('Результат')).toBeInTheDocument();
    expect(screen.getByText('Исполнитель')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Время')).toBeInTheDocument();
    expect(screen.getByText('Тип ресурса')).toBeInTheDocument();
    expect(screen.getByText('Ресурс')).toBeInTheDocument();
    expect(screen.getByText('IP-адрес')).toBeInTheDocument();
    expect(screen.getByText('Ошибка')).toBeInTheDocument();
    expect(screen.getByText('Детали')).toBeInTheDocument();
  });
});
