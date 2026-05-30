import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DeviceSecurityTab from './DeviceSecurityTab';
import { fetchWithAuth } from '../../stores/auth';

vi.mock('../../lib/featureFlags', () => ({
  ENABLE_ENDPOINT_AV_FEATURES: true
}));

vi.mock('../../stores/auth', () => ({
  fetchWithAuth: vi.fn()
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

const makeJsonResponse = (payload: unknown, ok = true, status = ok ? 200 : 500): Response =>
  ({
    ok,
    status,
    statusText: ok ? 'OK' : 'ERROR',
    json: vi.fn().mockResolvedValue(payload)
  }) as unknown as Response;

const deviceId = '11111111-1111-1111-1111-111111111111';

describe('DeviceSecurityTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'localStorage', {
      value: makeMemoryStorage(),
      writable: true,
      configurable: true,
    });
    window.localStorage.setItem('breeze_locale', 'en');
    document.cookie = 'breeze_locale=; Max-Age=0; Path=/';

    fetchWithAuthMock.mockImplementation(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url === `/security/status/${deviceId}` && method === 'GET') {
        return makeJsonResponse({
          data: {
            deviceId,
            deviceName: 'FIN-WS-014',
            provider: { name: 'Microsoft Defender', vendor: 'Microsoft' },
            providerVersion: '1.0',
            definitionsVersion: '1.0',
            definitionsUpdatedAt: new Date().toISOString(),
            lastScanAt: new Date().toISOString(),
            lastScanType: 'quick',
            realTimeProtection: true,
            firewallEnabled: true,
            encryptionStatus: 'encrypted',
            status: 'protected',
            threatsDetected: 1
          }
        });
      }

      if (url.startsWith(`/security/threats/${deviceId}`) && method === 'GET') {
        return makeJsonResponse({
          data: [
            {
              id: 'thr-1',
              name: 'Trojan:Win32/Emotet',
              severity: 'critical',
              status: 'active',
              detectedAt: new Date().toISOString(),
              filePath: 'C:\\malware.exe'
            }
          ]
        });
      }

      if (url.startsWith(`/security/scans/${deviceId}`) && method === 'GET') {
        return makeJsonResponse({
          data: [
            {
              id: 'scan-1',
              scanType: 'quick',
              status: 'completed',
              startedAt: new Date().toISOString(),
              finishedAt: new Date().toISOString(),
              threatsFound: 1
            }
          ]
        });
      }

      if (url === `/security/scan/${deviceId}` && method === 'POST') {
        return makeJsonResponse({ data: { id: 'scan-2' } }, true, 202);
      }

      if (url === '/security/threats/thr-1/quarantine' && method === 'POST') {
        return makeJsonResponse({ data: { id: 'thr-1' } });
      }

      return makeJsonResponse({}, false, 404);
    });
  });

  it('renders device security status, recent threats, and recent scans', async () => {
    render(<DeviceSecurityTab deviceId={deviceId} />);

    await screen.findByText(/FIN-WS-014/i);
    await screen.findByText('Trojan:Win32/Emotet');
    await screen.findByText(/threats found: 1/i);

    expect(fetchWithAuthMock).toHaveBeenCalledWith(`/security/status/${deviceId}`);
    expect(fetchWithAuthMock).toHaveBeenCalledWith(`/security/threats/${deviceId}?limit=10`);
    expect(fetchWithAuthMock).toHaveBeenCalledWith(`/security/scans/${deviceId}?limit=10`);
  });

  it('runs a full scan from the device security operations panel', async () => {
    render(<DeviceSecurityTab deviceId={deviceId} />);

    await screen.findByText(/FIN-WS-014/i);

    fireEvent.click(screen.getByRole('button', { name: /run full scan/i }));

    await waitFor(() => {
      expect(fetchWithAuthMock).toHaveBeenCalledWith(
        `/security/scan/${deviceId}`,
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  it('quarantines an active threat from the threat card', async () => {
    render(<DeviceSecurityTab deviceId={deviceId} />);

    await screen.findByText('Trojan:Win32/Emotet');

    fireEvent.click(screen.getByRole('button', { name: /quarantine/i }));

    await waitFor(() => {
      expect(fetchWithAuthMock).toHaveBeenCalledWith('/security/threats/thr-1/quarantine', expect.objectContaining({ method: 'POST' }));
    });
  });

  it('renders Russian security operations, threat, and scan labels', async () => {
    window.localStorage.setItem('breeze_locale', 'ru');

    render(<DeviceSecurityTab deviceId={deviceId} />);

    expect(await screen.findByText('Операции безопасности')).toBeInTheDocument();
    expect(screen.getByText('Запускайте сканирования и просматривайте последние события обнаружения на этом устройстве.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Запустить полное сканирование/i })).toBeInTheDocument();
    expect(screen.getByText('Последние угрозы')).toBeInTheDocument();
    expect(screen.getByText('Критическая')).toBeInTheDocument();
    expect(screen.getByText('Активна')).toBeInTheDocument();
    expect(screen.getByText(/Обнаружено:/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Карантин/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Удалить/i })).toBeInTheDocument();
    expect(screen.getByText('Последние сканирования')).toBeInTheDocument();
    expect(screen.getByText('Быстрое сканирование')).toBeInTheDocument();
    expect(screen.getByText('Завершено')).toBeInTheDocument();
    expect(screen.getByText(/Найдено угроз: 1/)).toBeInTheDocument();
  });
});
