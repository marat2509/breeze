import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DevicePlaybookHistory from './DevicePlaybookHistory';
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

describe('DevicePlaybookHistory localization', () => {
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

  it('renders Russian playbook execution labels and expanded step details', async () => {
    fetchWithAuthMock.mockResolvedValueOnce(makeJsonResponse({
      executions: [
        {
          execution: {
            id: 'exec-1',
            status: 'completed',
            currentStepIndex: 0,
            steps: [
              {
                stepIndex: 0,
                stepName: 'Restart service',
                status: 'completed',
                toolUsed: 'service.restart',
                durationMs: 1200,
              },
            ],
            rollbackExecuted: true,
            triggeredBy: 'AI assistant',
            startedAt: '2026-05-30T10:00:00.000Z',
            completedAt: '2026-05-30T10:01:05.000Z',
            createdAt: '2026-05-30T10:00:00.000Z',
          },
          playbook: {
            id: 'playbook-1',
            name: 'Restart Endpoint Service',
            category: 'service',
          },
          device: {
            id: 'device-1',
            hostname: 'FIN-WS-014',
          },
        },
      ],
    }));

    render(<DevicePlaybookHistory deviceId="device-1" timezone="UTC" />);

    expect(await screen.findByText('История плейбуков')).toBeInTheDocument();
    expect(screen.getByText('Обновить')).toBeInTheDocument();
    expect(screen.getByText(/Длительность:/)).toBeInTheDocument();
    expect(screen.getByText(/Запустил:/)).toBeInTheDocument();
    expect(screen.getByText('Завершено')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Restart Endpoint Service'));

    expect(await screen.findByText('Откат был выполнен')).toBeInTheDocument();
    expect(screen.getByText('Шаги')).toBeInTheDocument();
    expect(screen.getByText('Готово')).toBeInTheDocument();
  });
});
