import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import UpdateRingForm from './UpdateRingForm';

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

describe('UpdateRingForm localization', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      value: makeMemoryStorage(),
      writable: true,
      configurable: true,
    });
    window.localStorage.setItem('breeze_locale', 'ru');
    document.cookie = 'breeze_locale=; Max-Age=0; Path=/';
  });

  it('renders Russian form labels, empty state, category options, and actions', () => {
    render(<UpdateRingForm onCancel={() => {}} />);

    expect(screen.getByText('Название')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('например, Pilot, Broad')).toBeInTheDocument();
    expect(screen.getByText('Порядок')).toBeInTheDocument();
    expect(screen.getByText('Отсрочка (дн.)')).toBeInTheDocument();
    expect(screen.getByText('Крайний срок (дн.)')).toBeInTheDocument();
    expect(screen.getByText('Льготный период (ч.)')).toBeInTheDocument();
    expect(screen.getByText('Описание')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Необязательное описание')).toBeInTheDocument();
    expect(screen.getByText('Правила категорий')).toBeInTheDocument();
    expect(screen.getByText('Правил нет — все патчи требуют ручного одобрения.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Добавить правило категории' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Отмена' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Сохранить кольцо' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Добавить правило категории' }));

    expect(screen.getByDisplayValue('Обновления безопасности')).toBeInTheDocument();
    expect(screen.getByText('Автоодобрение')).toBeInTheDocument();
    expect(screen.getByText('Отсрочка')).toBeInTheDocument();
  });

  it('shows Russian validation messages', async () => {
    const onSubmit = vi.fn();
    render(<UpdateRingForm onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить кольцо' }));

    expect(await screen.findByText('Укажите название кольца')).toBeInTheDocument();
    await waitFor(() => expect(onSubmit).not.toHaveBeenCalled());
  });
});
