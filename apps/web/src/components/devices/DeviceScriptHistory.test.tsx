import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DeviceScriptHistory from './DeviceScriptHistory';
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

describe('DeviceScriptHistory localization', () => {
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

  it('renders Russian table labels and execution detail labels', async () => {
    fetchWithAuthMock.mockResolvedValue(makeJsonResponse({
      data: [
        {
          id: 'script-exec-1',
          scriptName: 'Patch Cleanup',
          status: 'completed',
          exitCode: 0,
          stdout: 'cleanup complete',
          stderr: '',
          startedAt: '2026-05-30T10:00:00.000Z',
          completedAt: '2026-05-30T10:00:12.000Z',
          durationSeconds: 12,
        },
      ],
    }));

    render(<DeviceScriptHistory deviceId="device-1" timezone="UTC" />);

    expect(await screen.findByText('История запусков скриптов')).toBeInTheDocument();
    expect(screen.getByText('Обновить')).toBeInTheDocument();
    expect(screen.getByText('Скрипт')).toBeInTheDocument();
    expect(screen.getByText('Статус')).toBeInTheDocument();
    expect(screen.getByText('Запущен')).toBeInTheDocument();
    expect(screen.getByText('Завершен')).toBeInTheDocument();
    expect(screen.getByText('Длительность')).toBeInTheDocument();
    expect(screen.getByText('Завершено')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Patch Cleanup'));

    expect(await screen.findByText('Детали выполнения')).toBeInTheDocument();
    expect(screen.getByText('Скрипт успешно выполнен')).toBeInTheDocument();
    expect(screen.getByText('Запущен в')).toBeInTheDocument();
    expect(screen.getByText('Завершен в')).toBeInTheDocument();
    expect(screen.getByText('Код выхода')).toBeInTheDocument();
    expect(screen.getByText('Вывод')).toBeInTheDocument();
    expect(screen.getByText('Стандартный вывод (stdout)')).toBeInTheDocument();
    expect(screen.getByText('Стандартная ошибка (stderr)')).toBeInTheDocument();
    expect(screen.getByText('(пусто)')).toBeInTheDocument();
    expect(screen.getAllByTitle('Скопировать в буфер обмена')).toHaveLength(1);
    expect(screen.getByText('Закрыть')).toBeInTheDocument();
  });
});
