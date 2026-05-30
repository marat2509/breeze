import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DeviceGroupsPage from './DeviceGroupsPage';
import { fetchWithAuth } from '@/stores/auth';

vi.mock('@/stores/auth', () => ({
  fetchWithAuth: vi.fn(),
}));

const fetchWithAuthMock = vi.mocked(fetchWithAuth);

const makeJsonResponse = (payload: unknown): Response =>
  ({
    ok: true,
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

function mockApi(payloads: {
  groups?: unknown[];
  devices?: unknown[];
  sites?: unknown[];
  policies?: unknown[];
  scripts?: unknown[];
}) {
  fetchWithAuthMock.mockImplementation(async (input) => {
    const url = String(input);
    if (url === '/device-groups') return makeJsonResponse({ groups: payloads.groups ?? [] });
    if (url === '/devices') return makeJsonResponse({ devices: payloads.devices ?? [] });
    if (url === '/sites') return makeJsonResponse({ sites: payloads.sites ?? [] });
    if (url === '/policies') return makeJsonResponse({ policies: payloads.policies ?? [] });
    if (url === '/scripts') return makeJsonResponse({ scripts: payloads.scripts ?? [] });
    return makeJsonResponse({});
  });
}

describe('DeviceGroupsPage localization', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      value: makeMemoryStorage(),
      writable: true,
      configurable: true,
    });
    window.localStorage.setItem('breeze_locale', 'ru');
    document.cookie = 'breeze_locale=; Max-Age=0; Path=/';
    fetchWithAuthMock.mockReset();
  });

  it('renders Russian empty state and create modal chrome', async () => {
    mockApi({});

    render(<DeviceGroupsPage />);

    expect(await screen.findByRole('heading', { name: 'Группы устройств' })).toBeDefined();
    expect(screen.getByText('Организуйте устройства в статические и динамические группы для точечных действий.')).toBeDefined();
    expect(screen.getByRole('button', { name: /Создать группу/ })).toBeDefined();
    expect(screen.getByText('Групп устройств пока нет. Создайте первую, чтобы начать организацию устройств.')).toBeDefined();
    expect(screen.getByRole('button', { name: /Создать первую группу/ })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: /Создать группу/ }));

    expect(await screen.findByRole('heading', { name: 'Создать группу устройств' })).toBeDefined();
    expect(screen.getByText('Задайте правила участия или назначьте устройства вручную.')).toBeDefined();
    expect(screen.getByText('Название группы')).toBeDefined();
    expect(screen.getByPlaceholderText('например, Production Linux')).toBeDefined();
    expect(screen.getByText('Назначение политики')).toBeDefined();
    expect(screen.getByRole('option', { name: 'Политика не назначена' })).toBeDefined();
    expect(screen.getByText('Тип группы')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Статическая' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Динамическая' })).toBeDefined();
  });

  it('renders Russian labels for a populated static group card', async () => {
    mockApi({
      groups: [
        {
          id: 'group-1',
          name: 'Servers',
          description: '',
          type: 'static',
          deviceCount: 1,
          deviceIds: ['device-1'],
        },
      ],
      devices: [
        {
          id: 'device-1',
          hostname: 'srv-01',
          os: 'windows',
          siteName: 'HQ',
        },
      ],
    });

    render(<DeviceGroupsPage />);

    expect(await screen.findByText('Servers')).toBeDefined();
    expect(screen.getByText('Статическая')).toBeDefined();
    expect(screen.getByText('Описание не указано.')).toBeDefined();
    expect(screen.getByText('1 устройство')).toBeDefined();
    expect(screen.getByText('Политика: не назначена')).toBeDefined();
    expect(screen.getByText('Устройства')).toBeDefined();
    expect(screen.getByText('Перетаскивайте устройства между группами')).toBeDefined();
    expect(screen.getByRole('button', { name: /Редактировать/ })).toBeDefined();
    expect(screen.getByRole('button', { name: /Удалить/ })).toBeDefined();
  });
});
