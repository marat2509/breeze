import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import MacOSPermissionsBanner from './MacOSPermissionsBanner';
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

describe('MacOSPermissionsBanner localization', () => {
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

  it('renders Russian Full Disk Access warning after TCC fetch', async () => {
    fetchWithAuthMock.mockResolvedValue(makeJsonResponse({
      tccPermissions: {
        fullDiskAccess: false,
        screenRecording: false,
        accessibility: false,
        remoteDesktop: null,
        checkedAt: '2026-05-30T12:00:00.000Z',
      },
    }));

    render(<MacOSPermissionsBanner deviceId="device-1" osType="macos" />);

    expect(await screen.findByText('Требуется полный доступ к диску')).toBeInTheDocument();
    expect(screen.getByText(/Полный доступ к диску обязателен/)).toBeInTheDocument();
    expect(screen.getByText('Полный доступ к диску')).toBeInTheDocument();
  });
});
