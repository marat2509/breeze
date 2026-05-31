import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import PatchComplianceView from './PatchComplianceView';
import { fetchWithAuth } from '../../stores/auth';

vi.mock('../../stores/auth', () => ({
  fetchWithAuth: vi.fn(),
}));

const fetchMock = vi.mocked(fetchWithAuth);

const makeJsonResponse = (payload: unknown, ok = true, status = ok ? 200 : 500): Response =>
  ({
    ok,
    status,
    statusText: ok ? 'OK' : 'ERROR',
    json: vi.fn().mockResolvedValue(payload),
  }) as unknown as Response;

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

describe('PatchComplianceView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'localStorage', {
      value: makeMemoryStorage(),
      writable: true,
      configurable: true,
    });
    document.cookie = 'breeze_locale=; Max-Age=0; Path=/';
  });

  it('renders the compliance summary, filters, table, and bulk confirm in Russian', async () => {
    window.localStorage.setItem('breeze_locale', 'ru');
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url === '/patches/compliance') {
        return makeJsonResponse({
          data: {
            devicesNeedingPatches: [
              {
                id: '11111111-1111-1111-1111-111111111111',
                name: 'Workstation-1',
                os: 'windows',
                missingCount: 2,
                criticalCount: 1,
                importantCount: 1,
                osMissing: 1,
                thirdPartyMissing: 1,
                pendingReboot: true,
                lastSeen: '2026-04-01T18:00:00.000Z',
              },
            ],
          },
        });
      }

      if (url === '/devices?limit=200') {
        return makeJsonResponse({
          devices: [
            {
              id: '11111111-1111-1111-1111-111111111111',
              hostname: 'Workstation-1',
              osType: 'windows',
              lastSeenAt: '2026-04-01T18:00:00.000Z',
            },
            {
              id: '44444444-4444-4444-4444-444444444444',
              hostname: 'Workstation-2',
              osType: 'windows',
              lastSeenAt: '2026-04-01T18:00:00.000Z',
            },
          ],
        });
      }

      return makeJsonResponse({}, false, 404);
    });

    render(<PatchComplianceView ringId={null} />);

    await screen.findByText('Workstation-1');
    expect(screen.getByText('50% соответствуют')).toBeInTheDocument();
    expect(screen.getByText('1 из 2 устройств')).toBeInTheDocument();
    expect(screen.getByText('1 требует патчей')).toBeInTheDocument();
    expect(screen.getByText('1 критический')).toBeInTheDocument();
    expect(screen.getByText('1 перезагрузка')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Экспорт' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Обновить данные соответствия' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Поиск устройств...')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Все устройства (2)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Требуют патчей (1)' })).toBeInTheDocument();
    expect(screen.getByText('Устройство')).toBeInTheDocument();
    expect(screen.getByText('Статус')).toBeInTheDocument();
    expect(screen.getByText('Патчи ОС')).toBeInTheDocument();
    expect(screen.getByText('Сторонние')).toBeInTheDocument();
    expect(screen.getByText('Критические')).toBeInTheDocument();
    expect(screen.getByText('Последняя активность')).toBeInTheDocument();
    expect(screen.getByText('Перезагрузка')).toBeInTheDocument();
    expect(screen.getByText('Действия')).toBeInTheDocument();
    expect(screen.getByText('2 отсутствует')).toBeInTheDocument();
    expect(screen.getByText('Да')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Открыть' })).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Выбрать Workstation-1' }));

    expect(screen.getByText('1 выбрано')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Сканировать' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Установить (1)' }));

    expect(screen.getByText('Установить патчи на 1 устройства?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Подтвердить' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Отмена' })).toBeInTheDocument();
  });

  it('resolves pending patch ids before queuing bulk install', async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url === '/patches/compliance') {
        return makeJsonResponse({
          data: {
            summary: { total: 3, pending: 2, installed: 1, failed: 0, missing: 0 },
            compliancePercent: 50,
            totalDevices: 1,
            compliantDevices: 0,
            criticalSummary: { total: 1, patched: 0, pending: 1 },
            importantSummary: { total: 1, patched: 0, pending: 1 },
            devicesNeedingPatches: [
              {
                id: '11111111-1111-1111-1111-111111111111',
                name: 'Workstation-1',
                os: 'windows',
                missingCount: 2,
                criticalCount: 1,
                importantCount: 1,
                osMissing: 2,
                thirdPartyMissing: 0,
                pendingReboot: false,
                lastSeen: '2026-04-01T18:00:00.000Z',
              },
            ],
          },
        });
      }

      if (url === '/devices?limit=200') {
        return makeJsonResponse({
          devices: [
            {
              id: '11111111-1111-1111-1111-111111111111',
              hostname: 'Workstation-1',
              osType: 'windows',
              lastSeenAt: '2026-04-01T18:00:00.000Z',
            },
          ],
        });
      }

      if (url === '/devices/11111111-1111-1111-1111-111111111111/patches') {
        return makeJsonResponse({
          data: {
            pending: [
              { id: '22222222-2222-2222-2222-222222222222', title: 'KB5050001' },
              { id: '33333333-3333-3333-3333-333333333333', title: 'KB5050002' },
            ],
          },
        });
      }

      if (url === '/devices/11111111-1111-1111-1111-111111111111/patches/install') {
        return makeJsonResponse({
          success: true,
          commandId: 'cmd-install-1',
          commandStatus: 'sent',
          patchCount: 2,
        });
      }

      return makeJsonResponse({}, false, 404);
    });

    render(<PatchComplianceView ringId={null} />);

    await screen.findByText('Workstation-1');

    fireEvent.click(screen.getByRole('button', { name: 'Select Workstation-1' }));
    fireEvent.click(screen.getByRole('button', { name: /Install \(1\)/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/devices/11111111-1111-1111-1111-111111111111/patches/install',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            patchIds: [
              '22222222-2222-2222-2222-222222222222',
              '33333333-3333-3333-3333-333333333333',
            ],
          }),
        })
      );
    });

    expect(await screen.findByText('Patch install queued on 1 device')).toBeTruthy();
  });
});
