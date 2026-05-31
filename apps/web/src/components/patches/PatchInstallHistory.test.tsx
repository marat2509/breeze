import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import PatchInstallHistory from './PatchInstallHistory';
import { fetchWithAuth } from '../../stores/auth';

vi.mock('../../stores/auth', () => ({
  fetchWithAuth: vi.fn()
}));

vi.mock('@/lib/navigation', () => ({
  navigateTo: vi.fn()
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
    }
  };
}

function makeJsonResponse(payload: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue(payload)
  } as unknown as Response;
}

describe('PatchInstallHistory localization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'localStorage', {
      value: makeMemoryStorage(),
      writable: true,
      configurable: true
    });
    window.localStorage.setItem('breeze_locale', 'ru');
    document.cookie = 'breeze_locale=; Max-Age=0; Path=/';
  });

  it('renders Russian history labels, filters, and expanded details', async () => {
    fetchWithAuthMock.mockResolvedValue(makeJsonResponse({
      data: {
        total: 1,
        history: [
          {
            id: 'history-1',
            type: 'install_patches',
            status: 'completed',
            createdAt: '2026-05-30T10:00:00.000Z',
            completedAt: '2026-05-30T10:02:05.000Z',
            createdByEmail: 'admin@example.com',
            result: {
              installedCount: 1,
              failedCount: 1,
              rebootRequired: true,
              results: [
                {
                  id: 'patch-1',
                  name: 'Security Update for Windows',
                  kb: '5050001',
                  status: 'installed',
                  rebootRequired: true
                },
                {
                  id: 'patch-2',
                  name: 'Driver Update',
                  status: 'failed',
                  errorMessage: 'Driver package failed'
                }
              ]
            }
          }
        ]
      }
    }));

    render(<PatchInstallHistory deviceId="device-1" />);

    expect(await screen.findByText('История операций с патчами')).toBeInTheDocument();
    expect(screen.getByText('1 операция')).toBeInTheDocument();
    expect(screen.getByText('Все типы')).toBeInTheDocument();
    expect(screen.getByText('Все статусы')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Обновить' })).toBeInTheDocument();
    expect(screen.getByText('Операция')).toBeInTheDocument();
    expect(screen.getByText('Длительность')).toBeInTheDocument();
    expect(screen.getByText('Дата')).toBeInTheDocument();
    const installLabels = screen.getAllByText('Установка');
    expect(installLabels.length).toBeGreaterThan(1);
    expect(screen.getAllByText('Завершено').length).toBeGreaterThan(1);

    fireEvent.click(installLabels[1]);

    expect(await screen.findByText('Результаты патчей')).toBeInTheDocument();
    expect(screen.getAllByText('Установлено').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Ошибка').length).toBeGreaterThan(0);
    expect(screen.getByText('Требуется перезагрузка')).toBeInTheDocument();
    expect(screen.getByText('Патч')).toBeInTheDocument();
  });
});
