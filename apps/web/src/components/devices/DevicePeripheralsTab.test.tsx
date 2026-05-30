import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DevicePeripheralsTab from './DevicePeripheralsTab';
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

describe('DevicePeripheralsTab localization', () => {
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

  it('renders Russian peripheral summaries and empty states', async () => {
    fetchWithAuthMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/peripherals/activity')) {
        return makeJsonResponse({ data: [] });
      }
      return makeJsonResponse({ data: [] });
    });

    render(<DevicePeripheralsTab deviceId="device-1" />);

    expect(await screen.findByText('События (24ч)')).toBeInTheDocument();
    expect(screen.getByText('Заблокировано (24ч)')).toBeInTheDocument();
    expect(screen.getByText('Подключено (24ч)')).toBeInTheDocument();
    expect(screen.getAllByText('Активные политики')).toHaveLength(2);
    expect(screen.getByText('Последние события')).toBeInTheDocument();
    expect(screen.getByText('События периферии для этого устройства не записаны.')).toBeInTheDocument();
    expect(screen.getByText('Нет активных политик периферии.')).toBeInTheDocument();
  });
});
