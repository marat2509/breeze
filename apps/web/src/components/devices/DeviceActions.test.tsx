import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DeviceActions from './DeviceActions';
import type { Device } from './DeviceList';

vi.mock('../remote/ConnectDesktopButton', () => ({
  default: () => <button type="button">Remote Desktop</button>,
}));

const baseDevice: Device = {
  id: 'device-1',
  hostname: 'edge-01',
  os: 'windows',
  osVersion: '11',
  status: 'online',
  cpuPercent: 58,
  ramPercent: 71,
  lastSeen: '2026-02-09T10:00:00.000Z',
  orgId: 'org-1',
  orgName: 'Org One',
  siteId: 'site-1',
  siteName: 'HQ',
  agentVersion: '1.0.0',
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

describe('DeviceActions localization', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      value: makeMemoryStorage(),
      writable: true,
      configurable: true,
    });
    window.localStorage.setItem('breeze_locale', 'ru');
    document.cookie = 'breeze_locale=; Max-Age=0; Path=/';
  });

  it('renders Russian action labels and confirmation text', () => {
    render(<DeviceActions device={baseDevice} onAction={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Запустить скрипт' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Удалённые инструменты' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Обновить' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Перезагрузка' })).toBeDefined();

    fireEvent.click(screen.getByLabelText('Дополнительные действия'));

    expect(screen.getByText('Включить обслуживание')).toBeDefined();
    expect(screen.getByText('Установить ПО')).toBeDefined();
    expect(screen.getByText('Выключить')).toBeDefined();
    expect(screen.getByText('Перезагрузка в Safe Mode')).toBeDefined();
    expect(screen.getByText('Очистить сессии')).toBeDefined();
    expect(screen.getByText('Сменить сайт')).toBeDefined();
    expect(screen.getByText('Настройки устройства')).toBeDefined();

    fireEvent.click(screen.getByText('Вывести из эксплуатации'));

    expect(screen.getByText('Вывести устройство из эксплуатации')).toBeDefined();
    expect(screen.getByText('Вы действительно хотите вывести edge-01 из эксплуатации? Устройство будет удалено из активного парка, агент перестанет отчитываться, а мониторинг будет остановлен.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Отмена' })).toBeDefined();
  });
});
