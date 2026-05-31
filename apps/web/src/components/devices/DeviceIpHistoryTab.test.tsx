import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DeviceIpHistoryTab from './DeviceIpHistoryTab';
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

describe('DeviceIpHistoryTab localization', () => {
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

  it('renders Russian filters, table headers, assignment badges, and statuses', async () => {
    fetchWithAuthMock.mockResolvedValue(makeJsonResponse({
      count: 1,
      data: [
        {
          id: 'ip-1',
          interfaceName: 'Wi-Fi',
          ipAddress: '192.0.2.10',
          ipType: 'ipv4',
          assignmentType: 'static',
          macAddress: '00:11:22:33:44:55',
          gateway: '192.0.2.1',
          dnsServers: ['1.1.1.1'],
          firstSeen: '2026-05-30T08:00:00.000Z',
          lastSeen: '2026-05-30T10:00:00.000Z',
          isActive: true,
        },
      ],
    }));

    render(<DeviceIpHistoryTab deviceId="device-1" />);

    expect(await screen.findByText('История назначений IP')).toBeInTheDocument();
    expect(screen.getByText('Обновить')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Поиск IP, интерфейса, шлюза, DNS...')).toBeInTheDocument();
    expect(screen.getByText('Все назначения')).toBeInTheDocument();
    expect(screen.getByText('Все интерфейсы')).toBeInTheDocument();
    expect(screen.getByText('Все типы IP')).toBeInTheDocument();
    expect(screen.getByText('Только активные')).toBeInTheDocument();
    expect(screen.getByText('С')).toBeInTheDocument();
    expect(screen.getByText('По')).toBeInTheDocument();
    expect(screen.getByText('Интерфейс')).toBeInTheDocument();
    expect(screen.getByText('IP-адрес')).toBeInTheDocument();
    expect(screen.getByText('Тип')).toBeInTheDocument();
    expect(screen.getByText('Назначение')).toBeInTheDocument();
    expect(screen.getByText('Впервые замечен')).toBeInTheDocument();
    expect(screen.getByText('Последний раз')).toBeInTheDocument();
    expect(screen.getByText('Статус')).toBeInTheDocument();
    expect(screen.getAllByText('Wi-Fi').length).toBeGreaterThan(0);
    expect(screen.getByText('192.0.2.10')).toBeInTheDocument();
    expect(screen.getAllByText('Статический').length).toBeGreaterThan(0);
    expect(screen.getByText('Активен')).toBeInTheDocument();
  });
});
