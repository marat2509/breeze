import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DeviceEffectiveConfigTab from './DeviceEffectiveConfigTab';
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

describe('DeviceEffectiveConfigTab localization', () => {
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

  it('renders Russian effective configuration labels and inheritance table', async () => {
    fetchWithAuthMock.mockResolvedValue(makeJsonResponse({
      deviceId: 'device-1',
      features: {
        patch: {
          featureType: 'patch',
          featurePolicyId: '12345678-90ab-cdef-1234-567890abcdef',
          inlineSettings: {
            autoInstall: true,
            rebootWindow: 'nightly',
            targets: ['critical', 'security'],
          },
          sourceLevel: 'organization',
          sourceTargetId: 'org-1',
          sourcePolicyId: 'policy-1',
          sourcePolicyName: 'Default Patch Policy',
          sourcePriority: 10,
        },
      },
      inheritanceChain: [
        {
          level: 'organization',
          targetId: 'org-1',
          policyId: 'policy-1',
          policyName: 'Default Patch Policy',
          priority: 10,
          featureTypes: ['patch'],
        },
      ],
    }));

    render(<DeviceEffectiveConfigTab deviceId="device-1" />);

    expect(await screen.findByText('Итоговая конфигурация')).toBeInTheDocument();
    expect(screen.getByText('Обновить')).toBeInTheDocument();
    expect(screen.getAllByText('Управление патчами').length).toBeGreaterThan(0);
    expect(screen.getByText('Из:')).toBeInTheDocument();
    expect(screen.getAllByText('Организация').length).toBeGreaterThan(0);
    expect(screen.getByText(/Связанная политика:/)).toBeInTheDocument();
    expect(screen.getByText('Цепочка наследования')).toBeInTheDocument();
    expect(screen.getByText('Приоритет')).toBeInTheDocument();
    expect(screen.getByText('Уровень')).toBeInTheDocument();
    expect(screen.getByText('Политика')).toBeInTheDocument();
    expect(screen.getByText('Функции')).toBeInTheDocument();
    expect(screen.getByText('Правила оповещений')).toBeInTheDocument();
    expect(screen.getAllByText('Нет назначенной политики').length).toBeGreaterThan(0);
  });
});
