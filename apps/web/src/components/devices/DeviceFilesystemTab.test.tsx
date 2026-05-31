import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DeviceFilesystemTab from './DeviceFilesystemTab';
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

function makeJsonResponse(payload: unknown, ok = true, status = ok ? 200 : 500): Response {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'ERROR',
    json: vi.fn().mockResolvedValue(payload),
  } as unknown as Response;
}

describe('DeviceFilesystemTab localization', () => {
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

  it('renders Russian filesystem intelligence labels and cleanup preview copy', async () => {
    fetchWithAuthMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/filesystem')) {
        return makeJsonResponse({
          data: {
            id: 'snapshot-1',
            capturedAt: '2026-05-30T10:00:00.000Z',
            trigger: 'threshold',
            partial: true,
            reason: 'timeout',
            path: 'C:\\',
            scanMode: 'incremental',
            summary: {
              filesScanned: 1200,
              dirsScanned: 300,
              bytesScanned: 1048576,
              maxDepthReached: 5,
              permissionDeniedCount: 2,
            },
            cleanupCandidates: [{ path: 'C:\\Temp\\a.tmp', category: 'temp_files', sizeBytes: 2048 }],
            topLargestFiles: [],
            topLargestDirectories: [{ path: 'C:\\Users', sizeBytes: 2048, estimated: true }],
            oldDownloads: [{ path: 'C:\\Downloads\\old.zip', sizeBytes: 1024 }],
            unrotatedLogs: [{ path: 'C:\\Logs\\app.log', sizeBytes: 1024 }],
            trashUsage: [{ path: 'C:\\$Recycle.Bin', sizeBytes: 1024 }],
            duplicateCandidates: [{ key: 'hash-1', sizeBytes: 1024, count: 2 }],
            errors: [{ path: 'C:\\Windows', error: 'denied' }],
          },
        });
      }
      if (url.includes('/commands?limit=100')) {
        return makeJsonResponse({
          data: [
            {
              id: 'command-1',
              type: 'filesystem_analysis',
              status: 'completed',
              createdAt: '2026-05-30T11:00:00.000Z',
              payload: { trigger: 'threshold', path: 'C:\\' },
            },
          ],
        });
      }
      if (url.endsWith('/filesystem/cleanup-preview')) {
        return makeJsonResponse({
          data: {
            cleanupRunId: 'cleanup-1',
            estimatedBytes: 2048,
            candidateCount: 1,
            categories: [{ category: 'temp_files', count: 1, estimatedBytes: 2048 }],
            candidates: [],
          },
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    render(<DeviceFilesystemTab deviceId="device-1" osType="windows" />);

    expect(await screen.findByText('BE-1: Интеллектуальная очистка диска')).toBeInTheDocument();
    expect(screen.getByText('Анализировать')).toBeInTheDocument();
    expect(screen.getByText('Предпросмотр очистки')).toBeInTheDocument();
    expect(screen.getByText('Открыть файловый менеджер')).toBeInTheDocument();
    expect(screen.getByText('Частичный результат сканирования: timeout')).toBeInTheDocument();
    expect(screen.getByText('Последнее сканирование')).toBeInTheDocument();
    expect(screen.getByText('Порог')).toBeInTheDocument();
    expect(screen.getByText('Инкрементальный')).toBeInTheDocument();
    expect(screen.getByText('Сводка сканирования')).toBeInTheDocument();
    expect(screen.getByText('Файлов просканировано')).toBeInTheDocument();
    expect(screen.getByText('Собранные сигналы')).toBeInTheDocument();
    expect(screen.getByText('Недавние пороговые запуски')).toBeInTheDocument();
    expect(screen.getByText('Завершено')).toBeInTheDocument();
    expect(screen.getByText('Крупнейшие файлы')).toBeInTheDocument();
    expect(screen.getByText('Нет данных о файлах.')).toBeInTheDocument();
    expect(screen.getByText('Крупнейшие папки')).toBeInTheDocument();
    expect(screen.getByText('>= означает нижнюю оценку размера из-за частичного обхода.')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Предпросмотр очистки'));

    expect(await screen.findByText('Последний предпросмотр очистки')).toBeInTheDocument();
    expect(screen.getByText('Ожидаемое освобождение')).toBeInTheDocument();
    expect(screen.getByText('По категориям')).toBeInTheDocument();
    expect(screen.getByText('Временные файлы')).toBeInTheDocument();
    expect(screen.getByText('Нет кандидатов.')).toBeInTheDocument();
  });
});
