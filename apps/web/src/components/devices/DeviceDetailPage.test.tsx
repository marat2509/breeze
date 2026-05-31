import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DeviceDetailPage from './DeviceDetailPage';
import { fetchWithAuth } from '../../stores/auth';

vi.mock('../../stores/auth', () => ({
  fetchWithAuth: vi.fn(),
}));

vi.mock('../../hooks/useEventStream', () => ({
  useEventStream: () => ({
    subscribe: vi.fn(),
  }),
}));

vi.mock('@/stores/aiStore', () => ({
  useAiStore: (selector: (state: { setPageContext: ReturnType<typeof vi.fn> }) => unknown) =>
    selector({ setPageContext: vi.fn() }),
}));

vi.mock('../layout/Breadcrumbs', () => ({
  default: ({ items }: { items: Array<{ label: string }> }) => (
    <nav>
      {items.map((item) => (
        <span key={item.label}>{item.label}</span>
      ))}
    </nav>
  ),
}));

vi.mock('./DeviceDetails', () => ({
  default: ({ device }: { device: { hostname: string } }) => (
    <div data-testid="device-details">{device.hostname}</div>
  ),
}));

vi.mock('./DeviceSettingsModal', () => ({ default: () => null }));
vi.mock('./ChangeSiteModal', () => ({ default: () => null }));
vi.mock('./ScriptPickerModal', () => ({ default: () => null }));

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

describe('DeviceDetailPage localization', () => {
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

  it('renders Russian breadcrumbs for a loaded device', async () => {
    fetchWithAuthMock.mockResolvedValue(makeJsonResponse({
      id: 'device-1',
      hostname: 'alpha',
      osType: 'windows',
      osVersion: '11',
      status: 'online',
      recentMetrics: [{ cpuPercent: 12, ramPercent: 34 }],
      orgId: 'org-1',
      orgName: 'Acme',
      siteId: 'site-1',
      siteName: 'HQ',
      agentVersion: '1.0.0',
      tags: [],
    }));

    render(<DeviceDetailPage deviceId="device-1" />);

    expect(await screen.findByText('Устройства')).toBeInTheDocument();
    expect(screen.getByTestId('device-details')).toHaveTextContent('alpha');
  });

  it('renders Russian not-found actions', async () => {
    fetchWithAuthMock.mockResolvedValue(makeJsonResponse({ error: 'missing' }, false, 404));

    render(<DeviceDetailPage deviceId="missing-device" />);

    expect(await screen.findByText('Устройство не найдено')).toBeInTheDocument();
    expect(screen.getByText('Назад к устройствам')).toBeInTheDocument();
    expect(screen.getByText('Вернуться')).toBeInTheDocument();
  });
});
