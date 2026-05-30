import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DeviceLogsTab from './DeviceLogsTab';
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

describe('DeviceLogsTab localization', () => {
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

  it('renders Russian filters, count label, and log badges', async () => {
    fetchWithAuthMock.mockResolvedValue(makeJsonResponse({
      data: [
        {
          id: 'log-1',
          deviceId: 'device-1',
          timestamp: '2026-05-30T10:00:00.000Z',
          level: 'error',
          category: 'security',
          source: 'Microsoft-Windows-Security-Auditing',
          eventId: '4625',
          message: 'Failed logon detected',
          details: { subject: 'ANONYMOUS LOGON' },
          createdAt: '2026-05-30T10:00:01.000Z',
        },
      ],
      pagination: { total: 1 },
    }));

    render(<DeviceLogsTab deviceId="device-1" timezone="UTC" osType="windows" />);

    expect(await screen.findByText('Журналы устройства')).toBeInTheDocument();
    expect(screen.getByText('1 запись журнала')).toBeInTheDocument();
    expect(screen.getByText('Фильтры')).toBeInTheDocument();
    expect(screen.getByText('Уровень')).toBeInTheDocument();
    expect(screen.getByText('Все уровни')).toBeInTheDocument();
    expect(screen.getByText('Категория')).toBeInTheDocument();
    expect(screen.getByText('Все категории')).toBeInTheDocument();
    expect(screen.getByText('Источник')).toBeInTheDocument();
    expect(screen.getByText('Дата начала')).toBeInTheDocument();
    expect(screen.getByText('Дата окончания')).toBeInTheDocument();
    expect(screen.getAllByText('Безопасность').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Ошибка').length).toBeGreaterThan(0);
    expect(screen.getByText('Failed logon detected')).toBeInTheDocument();
  });
});
