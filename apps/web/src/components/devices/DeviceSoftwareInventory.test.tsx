import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DeviceSoftwareInventory from './DeviceSoftwareInventory';
import { fetchWithAuth } from '../../stores/auth';
import { showToast } from '../shared/Toast';

vi.mock('../../stores/auth', () => ({
  fetchWithAuth: vi.fn(),
}));

vi.mock('../shared/Toast', () => ({
  showToast: vi.fn(),
}));

const fetchWithAuthMock = vi.mocked(fetchWithAuth);
const showToastMock = vi.mocked(showToast);

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
    json: vi.fn().mockResolvedValue(payload),
  }) as unknown as Response;

const deviceId = '11111111-1111-1111-1111-111111111111';

const SOFTWARE_FIXTURE = {
  data: [
    {
      id: 'sw-chrome',
      name: 'Google Chrome',
      version: '125.0.6422.142',
      publisher: 'Google LLC',
      installDate: '2026-02-01',
    },
    {
      id: 'sw-safari',
      name: 'Safari',
      version: '17.5',
      publisher: 'Apple Inc.',
      installDate: '2026-01-01',
    },
  ],
};

describe('DeviceSoftwareInventory action buttons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'localStorage', {
      value: makeMemoryStorage(),
      writable: true,
      configurable: true,
    });
    window.localStorage.setItem('breeze_locale', 'en');
    document.cookie = 'breeze_locale=; Max-Age=0; Path=/';
  });

  it('renders Update and Uninstall buttons enabled on Windows', async () => {
    fetchWithAuthMock.mockResolvedValueOnce(makeJsonResponse(SOFTWARE_FIXTURE));

    render(<DeviceSoftwareInventory deviceId={deviceId} osType="windows" />);

    const updateBtn = await screen.findByTestId('software-update-sw-chrome');
    const uninstallBtn = await screen.findByTestId('software-uninstall-sw-chrome');
    expect(updateBtn).not.toBeDisabled();
    expect(uninstallBtn).not.toBeDisabled();
  });

  it('disables Update + Uninstall for Apple-published rows on macOS', async () => {
    fetchWithAuthMock.mockResolvedValueOnce(makeJsonResponse(SOFTWARE_FIXTURE));

    render(<DeviceSoftwareInventory deviceId={deviceId} osType="macos" />);

    const updateBtn = await screen.findByTestId('software-update-sw-safari');
    const uninstallBtn = await screen.findByTestId('software-uninstall-sw-safari');
    expect(updateBtn).toBeDisabled();
    expect(uninstallBtn).toBeDisabled();
    expect(updateBtn.getAttribute('title')).toContain('Apple-signed');
  });

  it('queues an update via POST /devices/:id/software/update and shows success toast', async () => {
    fetchWithAuthMock
      .mockResolvedValueOnce(makeJsonResponse(SOFTWARE_FIXTURE))
      .mockResolvedValueOnce(makeJsonResponse({ success: true, commandId: 'cmd-1', action: 'update' }));

    render(<DeviceSoftwareInventory deviceId={deviceId} osType="windows" />);

    const updateBtn = await screen.findByTestId('software-update-sw-chrome');
    fireEvent.click(updateBtn);

    await waitFor(() => {
      expect(fetchWithAuthMock).toHaveBeenCalledWith(
        `/devices/${deviceId}/software/update`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'Google Chrome', version: '125.0.6422.142' }),
        })
      );
    });

    await waitFor(() => {
      expect(showToastMock).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'success', message: expect.stringContaining('Update queued') })
      );
    });
  });

  it('shows confirmation dialog for Uninstall and only POSTs after confirm', async () => {
    fetchWithAuthMock
      .mockResolvedValueOnce(makeJsonResponse(SOFTWARE_FIXTURE))
      .mockResolvedValueOnce(makeJsonResponse({ success: true, commandId: 'cmd-2', action: 'uninstall' }));

    render(<DeviceSoftwareInventory deviceId={deviceId} osType="windows" />);

    const uninstallBtn = await screen.findByTestId('software-uninstall-sw-chrome');
    fireEvent.click(uninstallBtn);

    // Dialog appears
    expect(await screen.findByText('Uninstall Google Chrome?')).toBeTruthy();
    // Still no second fetch yet
    expect(fetchWithAuthMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('confirm-uninstall'));

    await waitFor(() => {
      expect(fetchWithAuthMock).toHaveBeenCalledWith(
        `/devices/${deviceId}/software/uninstall`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'Google Chrome', version: '125.0.6422.142' }),
        })
      );
    });

    await waitFor(() => {
      expect(showToastMock).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'success', message: expect.stringContaining('Uninstall queued') })
      );
    });
  });

  it('shows an error toast when the API returns a failure for update', async () => {
    fetchWithAuthMock
      .mockResolvedValueOnce(makeJsonResponse(SOFTWARE_FIXTURE))
      .mockResolvedValueOnce(makeJsonResponse({ error: 'Device offline' }, false, 503));

    render(<DeviceSoftwareInventory deviceId={deviceId} osType="windows" />);

    const updateBtn = await screen.findByTestId('software-update-sw-chrome');
    fireEvent.click(updateBtn);

    await waitFor(() => {
      expect(showToastMock).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error', message: expect.stringContaining('Device offline') })
      );
    });
  });

  it('Cancel closes the confirmation dialog without POSTing', async () => {
    fetchWithAuthMock.mockResolvedValueOnce(makeJsonResponse(SOFTWARE_FIXTURE));

    render(<DeviceSoftwareInventory deviceId={deviceId} osType="windows" />);

    const uninstallBtn = await screen.findByTestId('software-uninstall-sw-chrome');
    fireEvent.click(uninstallBtn);

    expect(await screen.findByText('Uninstall Google Chrome?')).toBeTruthy();

    fireEvent.click(screen.getByText('Cancel'));

    await waitFor(() => {
      expect(screen.queryByText('Uninstall Google Chrome?')).toBeNull();
    });
    // No second fetch
    expect(fetchWithAuthMock).toHaveBeenCalledTimes(1);
  });

  it('renders Russian software inventory labels and uninstall dialog', async () => {
    window.localStorage.setItem('breeze_locale', 'ru');
    fetchWithAuthMock.mockResolvedValueOnce(makeJsonResponse(SOFTWARE_FIXTURE));

    render(<DeviceSoftwareInventory deviceId={deviceId} osType="macos" />);

    expect(await screen.findByText('Установленное ПО')).toBeInTheDocument();
    expect(screen.getAllByText('Обновить').length).toBeGreaterThan(0);
    expect(screen.getByPlaceholderText('Поиск по названию, издателю или версии...')).toBeInTheDocument();
    expect(screen.getByText('Все')).toBeInTheDocument();
    expect(screen.getByText('Сторонние')).toBeInTheDocument();
    expect(screen.getByText('Все издатели (2)')).toBeInTheDocument();
    expect(screen.getByText('Название')).toBeInTheDocument();
    expect(screen.getByText('Версия')).toBeInTheDocument();
    expect(screen.getByText('Издатель')).toBeInTheDocument();
    expect(screen.getByText('Установлено')).toBeInTheDocument();
    expect(screen.getByText('Действия')).toBeInTheDocument();
    expect(screen.getAllByText('Удалить').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByTestId('software-uninstall-sw-chrome'));

    expect(await screen.findByText('Удалить Google Chrome?')).toBeInTheDocument();
    expect(screen.getByText(/Это поставит в очередь команду удаления/)).toBeInTheDocument();
    expect(screen.getByText('Отмена')).toBeInTheDocument();
  });
});
