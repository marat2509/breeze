import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DeviceManagementTab from './DeviceManagementTab';
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

describe('DeviceManagementTab localization', () => {
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

  it('renders Russian management posture labels and status badges', async () => {
    fetchWithAuthMock.mockResolvedValue(makeJsonResponse({
      deviceId: 'device-1',
      hostname: 'srv-01',
      collected: true,
      posture: {
        collectedAt: '2026-05-30T12:00:00.000Z',
        scanDurationMs: 142,
        identity: {
          joinType: 'hybrid_azure_ad',
          azureAdJoined: true,
          domainJoined: true,
          workplaceJoined: false,
          domainName: 'corp.example',
          tenantId: 'tenant-1',
          mdmUrl: 'https://mdm.example/enroll',
          source: 'agent',
        },
        categories: {
          rmm: [
            {
              name: 'Breeze Agent',
              version: '1.2.3',
              status: 'active',
            },
          ],
        },
        errors: ['registry timeout'],
      },
    }));

    render(<DeviceManagementTab deviceId="device-1" />);

    expect(await screen.findByText('Статус идентичности и каталога')).toBeInTheDocument();
    expect(screen.getByText('Обновить')).toBeInTheDocument();
    expect(screen.getByText('Hybrid Azure AD (Entra ID + локальный AD)')).toBeInTheDocument();
    expect(screen.getByText('Azure AD / Entra ID подключён')).toBeInTheDocument();
    expect(screen.getByText('Подключён к домену')).toBeInTheDocument();
    expect(screen.getByText('Workplace Join выполнен')).toBeInTheDocument();
    expect(screen.getByText('Домен:')).toBeInTheDocument();
    expect(screen.getByText('Источник обнаружения:')).toBeInTheDocument();
    expect(screen.getByText('Обнаруженные средства управления')).toBeInTheDocument();
    expect(screen.getByText('Обнаружено инструментов: 1 в категориях: 1')).toBeInTheDocument();
    expect(screen.getByText('Активно')).toBeInTheDocument();
    expect(screen.getByText('Предупреждения сканирования')).toBeInTheDocument();
    expect(screen.getByText(/Последнее сканирование:/)).toBeInTheDocument();
    expect(screen.getByText('Длительность сканирования: 142ms')).toBeInTheDocument();
  });
});
