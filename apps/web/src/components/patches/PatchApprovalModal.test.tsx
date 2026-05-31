import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import PatchApprovalModal from './PatchApprovalModal';
import { fetchWithAuth } from '../../stores/auth';

vi.mock('../../stores/auth', () => ({
  fetchWithAuth: vi.fn(),
}));

vi.mock('@/lib/navigation', () => ({
  navigateTo: vi.fn(),
}));

const fetchMock = vi.mocked(fetchWithAuth);

const makeJsonResponse = (payload: unknown, ok = true, status = ok ? 200 : 500): Response =>
  ({
    ok,
    status,
    statusText: ok ? 'OK' : 'ERROR',
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

describe('PatchApprovalModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'localStorage', {
      value: makeMemoryStorage(),
      writable: true,
      configurable: true,
    });
    window.localStorage.setItem('breeze_locale', 'ru');
    document.cookie = 'breeze_locale=; Max-Age=0; Path=/';
    fetchMock.mockResolvedValue(makeJsonResponse({ id: 'patch-1', status: 'deferred' }));
  });

  it('renders Russian labels and sends deferUntil when deferring a patch', async () => {
    const deferUntilLocal = '2026-04-08T09:00';

    render(
      <PatchApprovalModal
        open
        patch={{
          id: 'patch-1',
          title: 'Security Update',
          severity: 'critical',
          source: 'Microsoft',
          os: 'Windows',
          releaseDate: '2026-04-01T00:00:00.000Z',
          approvalStatus: 'pending',
        }}
        ringId="ring-1"
        onClose={() => {}}
      />
    );

    expect(screen.getByRole('dialog', { name: 'Проверка патча' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Проверка патча' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Закрыть' })).toBeInTheDocument();
    expect(screen.getByText('Примечания')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Добавьте контекст или причину решения...')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Отложить/i }));
    fireEvent.change(screen.getByLabelText(/Отложить до/i), {
      target: { value: deferUntilLocal },
    });
    fireEvent.click(screen.getAllByRole('button', { name: /Отложить/i }).at(-1)!);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/patches/patch-1/defer',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            note: '',
            ringId: 'ring-1',
            deferUntil: new Date(deferUntilLocal).toISOString(),
          }),
        })
      )
    );
  });

  it('localizes known backend approval errors', async () => {
    fetchMock.mockResolvedValueOnce(makeJsonResponse({ error: 'Ring access denied' }, false, 403));

    render(
      <PatchApprovalModal
        open
        patch={{
          id: 'patch-1',
          title: 'Security Update',
          severity: 'critical',
          source: 'Microsoft',
          os: 'Windows',
          releaseDate: '2026-04-01T00:00:00.000Z',
          approvalStatus: 'pending',
        }}
        ringId="ring-1"
        onClose={() => {}}
      />
    );

    fireEvent.click(screen.getAllByRole('button', { name: /Одобрить/i }).at(-1)!);

    expect(await screen.findByText('У вас нет прав для выполнения этого действия.')).toBeTruthy();
  });
});
