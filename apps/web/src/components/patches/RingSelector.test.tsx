import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import RingSelector from './RingSelector';

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

describe('RingSelector localization', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      value: makeMemoryStorage(),
      writable: true,
      configurable: true,
    });
    window.localStorage.setItem('breeze_locale', 'ru');
    document.cookie = 'breeze_locale=; Max-Age=0; Path=/';
  });

  it('renders Russian labels and keeps selection behavior', () => {
    const onChange = vi.fn();

    render(
      <RingSelector
        rings={[
          {
            id: 'ring-1',
            name: 'Pilot',
            ringOrder: 1,
            deferralDays: 7,
            enabled: true,
          },
        ]}
        selectedRingId={null}
        onChange={onChange}
      />
    );

    expect(screen.getByText('Кольцо обновлений:')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Все кольца')).toBeInTheDocument();
    expect(screen.getByText('Pilot (Порядок 1, +7 дн.)')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'ring-1' } });
    expect(onChange).toHaveBeenCalledWith('ring-1');
  });
});
