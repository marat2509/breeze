import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ScriptPickerModal from './ScriptPickerModal';
import { fetchWithAuth } from '../../stores/auth';

// --- Mocks ---

vi.mock('../../stores/auth', () => ({
  fetchWithAuth: vi.fn(),
}));

const fetchWithAuthMock = vi.mocked(fetchWithAuth);

const makeJsonResponse = (payload: unknown, ok = true, status = ok ? 200 : 500): Response =>
  ({
    ok,
    status,
    statusText: ok ? 'OK' : 'ERROR',
    json: vi.fn().mockResolvedValue(payload),
  }) as unknown as Response;

// Scripts fixture
const SCRIPTS_DATA = [
  {
    id: 'p1',
    name: 'No Params',
    language: 'bash',
    category: 'General',
    osTypes: ['linux'],
  },
  {
    id: 'p2',
    name: 'With Params',
    language: 'bash',
    category: 'General',
    osTypes: ['linux'],
    parameters: [
      { name: 'message', type: 'string', required: true, defaultValue: '' },
      { name: 'count', type: 'number', required: false, defaultValue: '5' },
    ],
  },
];

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

describe('ScriptPickerModal', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      value: makeMemoryStorage(),
      writable: true,
      configurable: true,
    });
    window.localStorage.setItem('breeze_locale', 'en');
    document.cookie = 'breeze_locale=; Max-Age=0; Path=/';
    vi.clearAllMocks();
    fetchWithAuthMock.mockResolvedValue(makeJsonResponse(SCRIPTS_DATA));
  });

  it('selecting a parameterless script calls onSelect with undefined parameters and closes the modal', async () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(
      <ScriptPickerModal isOpen onClose={onClose} onSelect={onSelect} />
    );

    // Wait for scripts to load
    await waitFor(() => {
      expect(screen.getByText('No Params')).toBeDefined();
    });

    fireEvent.click(screen.getByText('No Params'));

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'p1', name: 'No Params' }),
      'system',
      undefined
    );
    expect(onClose).toHaveBeenCalled();

    // Should not have transitioned to params view
    expect(screen.queryByText('Configure Parameters')).toBeNull();
  });

  it('renders Russian list and parameter labels from the selected locale', async () => {
    window.localStorage.setItem('breeze_locale', 'ru');

    render(
      <ScriptPickerModal isOpen onClose={vi.fn()} onSelect={vi.fn()} deviceHostname="host-1" />
    );

    expect(screen.getByRole('dialog', { name: 'Выбор скрипта' })).toBeDefined();
    expect(screen.getByText('Выбор скрипта')).toBeDefined();
    expect(screen.getByText('Запустить скрипт на host-1')).toBeDefined();
    expect(screen.getByPlaceholderText('Поиск скриптов...')).toBeDefined();
    expect(screen.getByRole('option', { name: 'Запуск от: System' })).toBeDefined();
    expect(screen.getByRole('option', { name: 'Запуск от: пользователь' })).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText('No Params')).toBeDefined();
    });

    expect(screen.getByRole('option', { name: 'Все категории' })).toBeDefined();
    expect(screen.getByText('2 скрипта доступно')).toBeDefined();

    fireEvent.click(screen.getByText('With Params'));

    expect(screen.getByText('Настроить параметры')).toBeDefined();
    expect(screen.getByText('Параметры')).toBeDefined();
    expect(screen.getByLabelText('Назад к списку скриптов')).toBeDefined();

    fireEvent.click(screen.getByText('Запустить скрипт'));

    expect(screen.getByText('Параметр "message" обязателен')).toBeDefined();
  });

  it('selecting a parameterized script transitions to params view and seeds defaults', async () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(
      <ScriptPickerModal isOpen onClose={onClose} onSelect={onSelect} />
    );

    await waitFor(() => {
      expect(screen.getByText('With Params')).toBeDefined();
    });

    fireEvent.click(screen.getByText('With Params'));

    // Should NOT have called onSelect yet
    expect(onSelect).not.toHaveBeenCalled();

    // Params view header should appear with the script name
    expect(screen.getByText('Configure Parameters')).toBeDefined();
    expect(screen.getByText('With Params')).toBeDefined();

    // message input should be visible and empty
    const messageInput = screen.getByDisplayValue('') as HTMLInputElement;
    expect(messageInput).toBeDefined();

    // count input should be pre-filled with '5'
    const countInput = screen.getByDisplayValue('5') as HTMLInputElement;
    expect(countInput).toBeDefined();
  });

  it('clicking Run with a missing required field shows the error and does not call onSelect', async () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(
      <ScriptPickerModal isOpen onClose={onClose} onSelect={onSelect} />
    );

    await waitFor(() => {
      expect(screen.getByText('With Params')).toBeDefined();
    });

    fireEvent.click(screen.getByText('With Params'));

    // Don't fill message — click Run Script without filling required field
    fireEvent.click(screen.getByText('Run Script'));

    expect(screen.getByText('Parameter "message" is required')).toBeDefined();
    expect(onSelect).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('filling required param then Run calls onSelect with values and closes', async () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(
      <ScriptPickerModal isOpen onClose={onClose} onSelect={onSelect} />
    );

    await waitFor(() => {
      expect(screen.getByText('With Params')).toBeDefined();
    });

    fireEvent.click(screen.getByText('With Params'));

    // Fill the message field
    const messageInput = screen.getByDisplayValue('') as HTMLInputElement;
    fireEvent.change(messageInput, { target: { value: 'hello' } });

    fireEvent.click(screen.getByText('Run Script'));

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'p2', name: 'With Params' }),
      'system',
      expect.objectContaining({ message: 'hello', count: 5 })
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('Back button returns to list view and clears param state, re-selecting re-seeds defaults', async () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(
      <ScriptPickerModal isOpen onClose={onClose} onSelect={onSelect} />
    );

    await waitFor(() => {
      expect(screen.getByText('With Params')).toBeDefined();
    });

    // Select the parameterized script
    fireEvent.click(screen.getByText('With Params'));

    // Type something in message
    const messageInput = screen.getByDisplayValue('') as HTMLInputElement;
    fireEvent.change(messageInput, { target: { value: 'dirty value' } });

    // Click Back
    fireEvent.click(screen.getByLabelText('Back to script list'));

    // List view should be visible again
    expect(screen.getByText('No Params')).toBeDefined();
    expect(screen.queryByText('Configure Parameters')).toBeNull();

    // Re-select With Params — should see fresh defaults (message = empty)
    fireEvent.click(screen.getByText('With Params'));

    expect(screen.getByDisplayValue('')).toBeDefined();
    expect(screen.queryByDisplayValue('dirty value')).toBeNull();
  });

  it('reopening the modal after viewing params returns to list view with cleared state', async () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    const { rerender } = render(
      <ScriptPickerModal isOpen onClose={onClose} onSelect={onSelect} />
    );

    await waitFor(() => {
      expect(screen.getByText('With Params')).toBeDefined();
    });

    // Select a parameterized script to transition to params view
    fireEvent.click(screen.getByText('With Params'));
    expect(screen.getByText('Configure Parameters')).toBeDefined();

    // Close the modal
    rerender(
      <ScriptPickerModal isOpen={false} onClose={onClose} onSelect={onSelect} />
    );

    // Reopen — reset fetch mock for second open
    fetchWithAuthMock.mockResolvedValue(makeJsonResponse(SCRIPTS_DATA));

    rerender(
      <ScriptPickerModal isOpen onClose={onClose} onSelect={onSelect} />
    );

    // Should be back in list view
    await waitFor(() => {
      expect(screen.getByText('No Params')).toBeDefined();
    });

    expect(screen.queryByText('Configure Parameters')).toBeNull();
  });
});
