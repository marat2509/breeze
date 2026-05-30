import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LoginForm from './LoginForm';

describe('LoginForm i18n', () => {
  it('renders Russian labels and validation messages', async () => {
    render(<LoginForm locale="ru" onSubmit={vi.fn()} />);

    expect(screen.getByLabelText('Email')).toBeTruthy();
    expect(screen.getByLabelText('Пароль')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Войти' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Войти' }));

    expect(await screen.findByText('Введите корректный email')).toBeTruthy();
    expect(await screen.findByText('Пароль должен быть не короче 8 символов')).toBeTruthy();
  });
});
