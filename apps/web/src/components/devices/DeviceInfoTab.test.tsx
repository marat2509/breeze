import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DeviceInfoTab from './DeviceInfoTab';
import { fetchWithAuth } from '../../stores/auth';
import { showToast } from '../shared/Toast';

vi.mock('../../stores/auth', () => ({
  fetchWithAuth: vi.fn(),
}));

// runAction calls showToast; mock it so we can assert error surfaces without
// rendering a real toast.
vi.mock('../shared/Toast', () => ({
  showToast: vi.fn(),
}));

const fetchWithAuthMock = vi.mocked(fetchWithAuth);
const showToastMock = vi.mocked(showToast);

const deviceId = '11111111-1111-1111-1111-111111111111';

function makeJsonResponse(payload: unknown, ok = true, status = ok ? 200 : 500): Response {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'ERROR',
    json: vi.fn().mockResolvedValue(payload),
  } as unknown as Response;
}

function mockInitialLoad(displayName: string | null) {
  fetchWithAuthMock.mockImplementation(async (input, init) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    if (url === `/devices/${deviceId}` && method === 'GET') {
      return makeJsonResponse({
        hostname: 'TST-LAPTOP-01',
        displayName,
        osType: 'windows',
        osVersion: '11',
        tags: [],
        status: 'online',
      });
    }
    if (url === '/custom-fields') {
      return makeJsonResponse({ data: [] });
    }
    return makeJsonResponse({}, false, 404);
  });
}

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

function installMemoryStorage(locale?: 'en' | 'ru') {
  Object.defineProperty(window, 'localStorage', {
    value: makeMemoryStorage(),
    writable: true,
    configurable: true,
  });
  if (locale) window.localStorage.setItem('breeze_locale', locale);
  document.cookie = 'breeze_locale=; Max-Age=0; Path=/';
}

describe('DeviceInfoTab localization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installMemoryStorage('ru');
  });

  it('renders Russian section labels, values, and edit controls', async () => {
    fetchWithAuthMock.mockImplementation(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (url === `/devices/${deviceId}` && method === 'GET') {
        return makeJsonResponse({
          hostname: 'TST-LAPTOP-01',
          displayName: null,
          osType: 'windows',
          osVersion: '11',
          osBuild: '22631',
          architecture: 'x64',
          agentVersion: '1.2.3',
          status: 'online',
          lastSeenAt: '2026-05-30T12:00:00.000Z',
          enrolledAt: '2026-05-01T12:00:00.000Z',
          lastUser: 'ACME\\admin',
          uptimeSeconds: 3661,
          deviceRole: 'server',
          deviceRoleSource: 'manual',
          tags: ['prod'],
          hardware: {
            serialNumber: 'SN-123',
            manufacturer: 'Dell',
            model: 'PowerEdge',
            cpuModel: 'Xeon',
            cpuCores: 8,
            cpuThreads: 16,
            ramTotalMb: 32768,
            diskTotalGb: 2048,
            gpuModel: 'Integrated',
            biosVersion: '1.0.0',
          },
        });
      }
      if (url === '/custom-fields') return makeJsonResponse({ data: [] });
      return makeJsonResponse({}, false, 404);
    });

    render(<DeviceInfoTab deviceId={deviceId} />);

    expect(await screen.findByText('Система')).toBeInTheDocument();
    expect(screen.getByText('Имя хоста')).toBeInTheDocument();
    expect(screen.getByText('Отображаемое имя')).toBeInTheDocument();
    expect(screen.getByText('Не задано')).toBeInTheDocument();
    expect(screen.getByText('Роль устройства')).toBeInTheDocument();
    expect(screen.getByText('Сервер')).toBeInTheDocument();
    expect(screen.getByText('Задано вручную')).toBeInTheDocument();
    expect(screen.getByText('Операционная система')).toBeInTheDocument();
    expect(screen.getByText('Сводка оборудования')).toBeInTheDocument();
    expect(screen.getByText('Версия агента')).toBeInTheDocument();
    expect(screen.getByText('В сети')).toBeInTheDocument();
    expect(screen.getByText('Последняя активность')).toBeInTheDocument();
    expect(screen.getByText('Теги')).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Редактировать отображаемое имя'));
    expect(screen.getByPlaceholderText('Оставьте пустым, чтобы очистить')).toBeInTheDocument();
    expect(screen.getByTitle('Сохранить')).toBeInTheDocument();
    expect(screen.getByTitle('Отмена')).toBeInTheDocument();
  });
});

describe('DeviceInfoTab — display name inline edit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installMemoryStorage();
  });

  it('saves a non-empty display name via PATCH', async () => {
    mockInitialLoad('Old Name');
    render(<DeviceInfoTab deviceId={deviceId} />);
    await screen.findByText('Old Name');

    // Wire the PATCH response BEFORE the click.
    fetchWithAuthMock.mockImplementationOnce(async () => makeJsonResponse({ ok: true }));

    fireEvent.click(screen.getByTitle('Edit display name'));
    const input = screen.getByPlaceholderText('Leave blank to clear') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'New Name' } });
    fireEvent.click(screen.getByTitle('Save'));

    await waitFor(() => {
      const patchCall = fetchWithAuthMock.mock.calls.find(
        ([, init]) => init?.method === 'PATCH',
      );
      expect(patchCall).toBeDefined();
      expect(patchCall?.[0]).toBe(`/devices/${deviceId}`);
      expect(JSON.parse(String(patchCall?.[1]?.body))).toEqual({ displayName: 'New Name' });
    });

    // After save, modal collapses and the new value renders.
    await waitFor(() => expect(screen.getByText('New Name')).toBeInTheDocument());
  });

  it('CLEARING the display name sends PATCH {displayName: null} (the headline use case)', async () => {
    mockInitialLoad('Existing Name');
    render(<DeviceInfoTab deviceId={deviceId} />);
    await screen.findByText('Existing Name');

    fetchWithAuthMock.mockImplementationOnce(async () => makeJsonResponse({ ok: true }));

    fireEvent.click(screen.getByTitle('Edit display name'));
    const input = screen.getByPlaceholderText('Leave blank to clear') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.click(screen.getByTitle('Save'));

    await waitFor(() => {
      const patchCall = fetchWithAuthMock.mock.calls.find(
        ([, init]) => init?.method === 'PATCH',
      );
      expect(patchCall).toBeDefined();
      const body = JSON.parse(String(patchCall?.[1]?.body));
      expect(body).toEqual({ displayName: null });
    });

    await waitFor(() => expect(screen.getByText('Not set')).toBeInTheDocument());
  });

  it('whitespace-only input is treated as clearing (trimmed → null)', async () => {
    mockInitialLoad('Existing');
    render(<DeviceInfoTab deviceId={deviceId} />);
    await screen.findByText('Existing');

    fetchWithAuthMock.mockImplementationOnce(async () => makeJsonResponse({ ok: true }));

    fireEvent.click(screen.getByTitle('Edit display name'));
    const input = screen.getByPlaceholderText('Leave blank to clear') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.click(screen.getByTitle('Save'));

    await waitFor(() => {
      const patchCall = fetchWithAuthMock.mock.calls.find(
        ([, init]) => init?.method === 'PATCH',
      );
      const body = JSON.parse(String(patchCall?.[1]?.body));
      expect(body).toEqual({ displayName: null });
    });
  });

  it('Cancel reverts to the original value without firing a PATCH', async () => {
    mockInitialLoad('Original');
    render(<DeviceInfoTab deviceId={deviceId} />);
    await screen.findByText('Original');

    fireEvent.click(screen.getByTitle('Edit display name'));
    const input = screen.getByPlaceholderText('Leave blank to clear') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Discarded edit' } });
    fireEvent.click(screen.getByTitle('Cancel'));

    expect(screen.getByText('Original')).toBeInTheDocument();
    const patchCall = fetchWithAuthMock.mock.calls.find(
      ([, init]) => init?.method === 'PATCH',
    );
    expect(patchCall).toBeUndefined();
  });

  it('surfaces an error toast when the API rejects the save (runAction integration)', async () => {
    mockInitialLoad('Old');
    render(<DeviceInfoTab deviceId={deviceId} />);
    await screen.findByText('Old');

    fetchWithAuthMock.mockImplementationOnce(async () =>
      makeJsonResponse({ error: 'Invalid display name' }, false, 400),
    );

    fireEvent.click(screen.getByTitle('Edit display name'));
    const input = screen.getByPlaceholderText('Leave blank to clear') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'New' } });
    fireEvent.click(screen.getByTitle('Save'));

    await waitFor(() => {
      expect(showToastMock).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error', message: 'Invalid display name' }),
      );
    });
    // The editor should NOT collapse on error — user keeps the chance to fix the value.
    expect(screen.getByPlaceholderText('Leave blank to clear')).toBeInTheDocument();
  });

  it('renders the inline error message at the top of the page (visible even with no custom fields)', async () => {
    mockInitialLoad('Old');
    render(<DeviceInfoTab deviceId={deviceId} />);
    await screen.findByText('Old');

    fetchWithAuthMock.mockImplementationOnce(async () =>
      makeJsonResponse({ error: 'Conflict — name already used' }, false, 409),
    );

    fireEvent.click(screen.getByTitle('Edit display name'));
    fireEvent.change(screen.getByPlaceholderText('Leave blank to clear'), {
      target: { value: 'Dup' },
    });
    fireEvent.click(screen.getByTitle('Save'));

    // The hoisted role="alert" container should render the message regardless
    // of whether the Custom Fields section is present.
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Conflict — name already used');
  });
});

// ---------------------------------------------------------------------------
// runAction adoption on the other two mutating handlers in this file.
// ---------------------------------------------------------------------------

describe('DeviceInfoTab — role + custom-field mutations also use runAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installMemoryStorage();
  });

  it('Device Role save fires success toast via runAction', async () => {
    // Initial load with a windows device that supports role editing.
    fetchWithAuthMock.mockImplementation(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (url === `/devices/${deviceId}` && method === 'GET') {
        return makeJsonResponse({
          hostname: 'TST-LAPTOP-01',
          displayName: null,
          osType: 'windows',
          deviceRole: 'workstation',
          deviceRoleSource: 'auto',
          tags: [],
          status: 'online',
        });
      }
      if (url === '/custom-fields') return makeJsonResponse({ data: [] });
      return makeJsonResponse({}, false, 404);
    });

    render(<DeviceInfoTab deviceId={deviceId} />);
    await screen.findByText('TST-LAPTOP-01');

    // PATCH succeeds with 200.
    fetchWithAuthMock.mockImplementationOnce(async () => makeJsonResponse({ ok: true }));

    const editRoleBtn = screen.getByTitle('Change role');
    fireEvent.click(editRoleBtn);
    // Find the role <select> and pick a non-current value.
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'server' } });
    fireEvent.click(screen.getByTitle('Save'));

    await waitFor(() => {
      expect(showToastMock).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'success', message: 'Device role saved' }),
      );
    });
  });
});
