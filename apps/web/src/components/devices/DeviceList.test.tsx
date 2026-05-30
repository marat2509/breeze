import { render, screen } from '@testing-library/react';
import { beforeEach, describe, it, expect, vi } from 'vitest';

import DeviceList, { type Device } from './DeviceList';

vi.mock('../../stores/auth', () => ({
  fetchWithAuth: vi.fn(),
}));
vi.mock('../remote/ConnectDesktopButton', () => ({
  default: () => null,
}));
vi.mock('@/lib/formatTime', () => ({
  formatLastSeen: () => 'just now',
}));

const baseDevice: Device = {
  id: '11111111-1111-1111-1111-111111111111',
  hostname: 'host-a',
  os: 'windows',
  osVersion: '11',
  status: 'online',
  cpuPercent: 10,
  ramPercent: 20,
  lastSeen: new Date().toISOString(),
  orgId: 'org-1',
  orgName: 'Acme',
  siteId: 'site-1',
  siteName: 'HQ',
  agentVersion: '0.67.0',
  tags: [],
};

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

beforeEach(() => {
  Object.defineProperty(window, 'localStorage', {
    value: makeMemoryStorage(),
    writable: true,
    configurable: true,
  });
  window.localStorage.clear();
  document.cookie = 'breeze_locale=; Max-Age=0; Path=/';
});

describe('DeviceList — agent-silent (watchdog OK) badge (#800 web-UI gap)', () => {
  it('renders the amber badge when mainAgentSilentSince is set AND watchdog is reporting', () => {
    const device: Device = {
      ...baseDevice,
      id: '22222222-2222-2222-2222-222222222222',
      hostname: 'host-silent-but-watchdog-ok',
      mainAgentSilentSince: new Date(Date.now() - 17 * 60_000).toISOString(),
      watchdogStatus: 'connected',
    };

    render(<DeviceList devices={[device]} />);

    const badge = screen.getByTestId(`device-${device.id}-agent-silent-badge`);
    expect(badge.textContent).toMatch(/Agent silent/i);
    // 17 minutes ago should render as "17m" (not "0h" or "1d")
    expect(badge.textContent).toMatch(/17m/);
  });

  it('does NOT render the badge when the watchdog is also offline (we trust device.status=offline instead)', () => {
    const device: Device = {
      ...baseDevice,
      id: '33333333-3333-3333-3333-333333333333',
      hostname: 'host-fully-offline',
      status: 'offline',
      mainAgentSilentSince: new Date(Date.now() - 60 * 60_000).toISOString(),
      watchdogStatus: 'offline',
    };

    render(<DeviceList devices={[device]} />);

    expect(screen.queryByTestId(`device-${device.id}-agent-silent-badge`)).toBeNull();
  });

  it('does NOT render the badge when the agent is heartbeating normally (mainAgentSilentSince null)', () => {
    const device: Device = {
      ...baseDevice,
      id: '44444444-4444-4444-4444-444444444444',
      hostname: 'host-healthy',
      mainAgentSilentSince: null,
      watchdogStatus: 'connected',
    };

    render(<DeviceList devices={[device]} />);

    expect(screen.queryByTestId(`device-${device.id}-agent-silent-badge`)).toBeNull();
  });

  it('still renders when watchdog reports FAILOVER (watchdog has taken over the heartbeat)', () => {
    const device: Device = {
      ...baseDevice,
      id: '55555555-5555-5555-5555-555555555555',
      hostname: 'host-failover',
      mainAgentSilentSince: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
      watchdogStatus: 'failover',
    };

    render(<DeviceList devices={[device]} />);

    const badge = screen.getByTestId(`device-${device.id}-agent-silent-badge`);
    // 2h should render as "2h"
    expect(badge.textContent).toMatch(/2h/);
  });
});

describe('DeviceList i18n', () => {
  it('renders the dense table controls in Russian', async () => {
    window.localStorage.setItem('breeze_locale', 'ru');

    render(<DeviceList devices={[baseDevice]} />);

    expect(await screen.findByText('1 из 1 устройств')).toBeDefined();
    expect(screen.getByPlaceholderText('Поиск по hostname')).toBeDefined();
    expect(screen.getByText('Все статусы')).toBeDefined();
    expect(screen.getByText('Организация')).toBeDefined();
    expect(screen.getByText('Последний раз в сети')).toBeDefined();
  });
});
