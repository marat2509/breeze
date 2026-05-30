import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DeviceWarrantyCard from './DeviceWarrantyCard';
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

describe('DeviceWarrantyCard localization', () => {
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

  it('renders Russian warranty labels and known provider text', async () => {
    fetchWithAuthMock.mockResolvedValue(makeJsonResponse({
      warranty: {
        id: 'warranty-1',
        deviceId: 'device-1',
        manufacturer: 'Dell',
        serialNumber: 'SN-123',
        status: 'active',
        warrantyStartDate: '2026-01-01T00:00:00.000Z',
        warrantyEndDate: '2027-01-01T00:00:00.000Z',
        entitlements: [
          {
            provider: 'dell',
            serviceLevelDescription: 'ProSupport',
            entitlementType: 'onsite',
            startDate: '2026-01-01T00:00:00.000Z',
            endDate: '2027-01-01T00:00:00.000Z',
          },
        ],
        dataSource: 'provider',
        lastSyncAt: new Date().toISOString(),
        lastSyncError: 'No configured provider for manufacturer',
      },
    }));

    render(<DeviceWarrantyCard deviceId="device-1" />);

    expect(await screen.findByText('Информация о гарантии')).toBeInTheDocument();
    expect(screen.getByText('Активна')).toBeInTheDocument();
    expect(screen.getByText('Обновить')).toBeInTheDocument();
    expect(screen.getByText('Производитель')).toBeInTheDocument();
    expect(screen.getByText('Серийный номер')).toBeInTheDocument();
    expect(screen.getAllByText('Дата начала')).toHaveLength(2);
    expect(screen.getAllByText('Дата окончания')).toHaveLength(2);
    expect(screen.getByText('Уровень обслуживания')).toBeInTheDocument();
    expect(screen.getByText('Тип')).toBeInTheDocument();
    expect(screen.getByText('Последняя проверка: только что')).toBeInTheDocument();
    expect(screen.getByText('Источник: API производителя')).toBeInTheDocument();
    expect(screen.getByText('Проверка гарантии недоступна для этого производителя')).toBeInTheDocument();
  });
});
