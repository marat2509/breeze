import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DeviceHardwareInventory from './DeviceHardwareInventory';
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

describe('DeviceHardwareInventory localization', () => {
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

  it('renders Russian hardware summary, disk table, and adapter labels', async () => {
    fetchWithAuthMock.mockResolvedValueOnce(makeJsonResponse({
      hardware: {
        cpuModel: 'Intel Core i7',
        cpuCores: 8,
        cpuThreads: 16,
        ramTotalMb: 16384,
        diskTotalGb: 512,
      },
      disks: [
        {
          id: 'disk-1',
          name: 'C:',
          sizeGb: 512,
          usedGb: 256,
          health: 'healthy',
        },
      ],
      networkAdapters: [
        {
          id: 'adapter-1',
          name: 'Ethernet',
          ipAddress: '10.0.0.2',
          macAddress: 'AA:BB:CC:DD:EE:FF',
          isPrimary: true,
          speedMbps: 1000,
        },
      ],
    }));

    render(<DeviceHardwareInventory deviceId="device-1" />);

    expect(await screen.findByText('Процессор')).toBeInTheDocument();
    expect(screen.getByText('Память')).toBeInTheDocument();
    expect(screen.getByText('Хранилище')).toBeInTheDocument();
    expect(screen.getByText(/8 ядер/)).toBeInTheDocument();
    expect(screen.getByText(/16 потоков/)).toBeInTheDocument();
    expect(screen.getByText('Всего установленной памяти')).toBeInTheDocument();
    expect(screen.getByText('Общая ёмкость дисков')).toBeInTheDocument();
    expect(screen.getByText('Диски')).toBeInTheDocument();
    expect(screen.getByText('Размер')).toBeInTheDocument();
    expect(screen.getByText('Использовано')).toBeInTheDocument();
    expect(screen.getByText('Состояние')).toBeInTheDocument();
    expect(screen.getByText('Исправен')).toBeInTheDocument();
    expect(screen.getByText('Сетевые адаптеры')).toBeInTheDocument();
    expect(screen.getByText('Основной')).toBeInTheDocument();
    expect(screen.getByText('IP-адрес')).toBeInTheDocument();
    expect(screen.getByText('MAC-адрес')).toBeInTheDocument();
    expect(screen.getByText('Скорость линка')).toBeInTheDocument();
  });
});
