import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import CreateGroupModal from './CreateGroupModal';

vi.mock('../../stores/auth', () => ({
  fetchWithAuth: vi.fn(),
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

describe('CreateGroupModal localization', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      value: makeMemoryStorage(),
      writable: true,
      configurable: true,
    });
    window.localStorage.setItem('breeze_locale', 'ru');
    document.cookie = 'breeze_locale=; Max-Age=0; Path=/';
  });

  it('renders Russian labels and dynamic group help text', () => {
    render(<CreateGroupModal isOpen onClose={vi.fn()} onCreated={vi.fn()} />);

    expect(screen.getByRole('dialog', { name: 'Новая группа устройств' })).toBeDefined();
    expect(screen.getByText('Новая группа устройств')).toBeDefined();
    expect(screen.getByLabelText('Название')).toHaveAttribute('placeholder', 'например, Production Servers');
    expect(screen.getByText('Тип')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Статическая' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Динамическая' })).toBeDefined();
    expect(screen.getByText('Добавляйте и удаляйте устройства вручную после создания.')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Динамическая' }));

    expect(screen.getByText('Устройства назначаются автоматически по правилам фильтрации.')).toBeDefined();
    expect(screen.getByText('Правила фильтрации')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Отмена' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Создать группу' })).toBeDisabled();
  });
});
