import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DeviceNetworkConnections from './DeviceNetworkConnections';
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

describe('DeviceNetworkConnections localization', () => {
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

  it('renders Russian network connection controls and empty filtered state', async () => {
    fetchWithAuthMock.mockResolvedValue(makeJsonResponse({
      data: [
        {
          id: 'connection-1',
          protocol: 'tcp',
          localAddr: '10.0.0.5',
          localPort: 443,
          remoteAddr: '93.184.216.34',
          remotePort: 51432,
          state: 'ESTABLISHED',
          processName: 'nginx',
          pid: 1234,
        },
      ],
    }));

    render(<DeviceNetworkConnections deviceId="device-1" />);

    expect(await screen.findByText('Активные сетевые подключения')).toBeInTheDocument();
    expect(screen.getByText('Обновить')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Поиск по процессу, адресу или порту...')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Все протоколы' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Все состояния' })).toBeInTheDocument();
    expect(screen.getByText('Протокол')).toBeInTheDocument();
    expect(screen.getByText('Локальный')).toBeInTheDocument();
    expect(screen.getByText('Удалённый')).toBeInTheDocument();
    expect(screen.getByText('Состояние')).toBeInTheDocument();
    expect(screen.getByText('Процесс')).toBeInTheDocument();
    expect(screen.getByText('PID')).toBeInTheDocument();
    expect(screen.getAllByText('TCP')).toHaveLength(2);
    expect(screen.getByText('nginx')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Поиск по процессу, адресу или порту...'), {
      target: { value: 'nomatch' },
    });

    expect(screen.getByText('Очистить')).toBeInTheDocument();
    expect(screen.getByText('Подключения не соответствуют фильтрам.')).toBeInTheDocument();
  });
});
