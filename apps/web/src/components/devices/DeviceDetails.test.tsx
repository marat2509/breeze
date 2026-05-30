import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Device } from './DeviceList';

import DeviceDetails from './DeviceDetails';

vi.mock('./DeviceActions', () => ({ default: () => <div data-testid="device-actions" /> }));
vi.mock('./DeviceInfoTab', () => ({ default: () => <div data-testid="device-info-tab" /> }));
vi.mock('./DeviceHardwareInventory', () => ({ default: () => <div /> }));
vi.mock('./DeviceSoftwareInventory', () => ({ default: () => <div /> }));
vi.mock('./DevicePatchStatusTab', () => ({ default: () => <div /> }));
vi.mock('./DeviceSecurityTab', () => ({ default: () => <div /> }));
vi.mock('./DeviceAlertHistory', () => ({ default: () => <div /> }));
vi.mock('./DeviceScriptHistory', () => ({ default: () => <div /> }));
vi.mock('./DevicePerformanceGraphs', () => ({ default: () => <div /> }));
vi.mock('./DeviceEventLogViewer', () => ({ default: () => <div /> }));
vi.mock('./DeviceLogsTab', () => ({ default: () => <div /> }));
vi.mock('./DeviceNetworkConnections', () => ({ default: () => <div /> }));
vi.mock('./DeviceFilesystemTab', () => ({ default: () => <div /> }));
vi.mock('./DeviceManagementTab', () => ({ default: () => <div /> }));
vi.mock('./DeviceEffectiveConfigTab', () => ({ default: () => <div /> }));
vi.mock('./DeviceIpHistoryTab', () => ({ default: () => <div /> }));
vi.mock('./DeviceBootPerformanceTab', () => ({ default: () => <div /> }));
vi.mock('./DevicePlaybookHistory', () => ({ default: () => <div /> }));
vi.mock('./DevicePeripheralsTab', () => ({ default: () => <div /> }));
vi.mock('./DeviceWarrantyCard', () => ({ default: () => <div /> }));
vi.mock('./MacOSPermissionsBanner', () => ({ default: () => <div /> }));
vi.mock('../backup/DeviceBackupTab', () => ({ default: () => <div /> }));
vi.mock('../shared/OverflowTabs', () => ({
  OverflowTabs: ({ tabs }: { tabs: Array<{ label: string; title?: string }> }) => (
    <div>
      {tabs.map(tab => (
        <button key={tab.label} type="button" title={tab.title}>
          {tab.label}
        </button>
      ))}
    </div>
  ),
}));

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

const device: Device = {
  id: 'device-1',
  hostname: 'srv-01',
  displayName: 'Server 01',
  os: 'windows',
  osVersion: 'Microsoft Windows 11 Pro',
  status: 'online',
  cpuPercent: 12.5,
  ramPercent: 42,
  lastSeen: new Date().toISOString(),
  orgId: 'org-1',
  orgName: 'Acme',
  siteId: 'site-1',
  siteName: 'HQ',
  agentVersion: '1.2.3',
  tags: [],
  lastUser: 'ACME\\admin',
  uptimeSeconds: 3600,
};

describe('DeviceDetails localization', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      value: makeMemoryStorage(),
      writable: true,
      configurable: true,
    });
    window.localStorage.setItem('breeze_locale', 'ru');
    document.cookie = 'breeze_locale=; Max-Age=0; Path=/';
    window.location.hash = '';
  });

  it('renders Russian shell labels and tab names', () => {
    render(<DeviceDetails device={device} timezone="UTC" />);

    expect(screen.getByRole('heading', { name: 'Server 01' })).toBeDefined();
    expect(screen.getByText('В сети')).toBeDefined();
    expect(screen.getByText('Windows 11 Pro')).toBeDefined();
    expect(screen.getByText('Агент v1.2.3')).toBeDefined();
    expect(screen.getByText('Последняя активность')).toBeDefined();
    expect(screen.getByText('Аптайм')).toBeDefined();
    expect(screen.getByText('Пользователь')).toBeDefined();

    for (const label of ['Обзор', 'Подробности', 'Производительность', 'Оповещения', 'Журнал событий', 'Оборудование', 'ПО', 'Патчи', 'Управление', 'Безопасность', 'Резервное копирование']) {
      expect(screen.getByRole('button', { name: label })).toBeDefined();
    }
  });
});
