import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import UpdateRingList, { type UpdateRingItem } from './UpdateRingList';

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

function makeRing(overrides: Partial<UpdateRingItem> = {}): UpdateRingItem {
  return {
    id: 'ring-1',
    name: 'Pilot',
    description: 'Early rollout group',
    enabled: true,
    ringOrder: 1,
    deferralDays: 7,
    deadlineDays: 14,
    gracePeriodHours: 4,
    compliancePercent: 95,
    deviceCount: 3,
    updatedAt: '2026-05-30T10:00:00.000Z',
    ...overrides,
  };
}

describe('UpdateRingList localization', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      value: makeMemoryStorage(),
      writable: true,
      configurable: true,
    });
    window.localStorage.setItem('breeze_locale', 'ru');
    document.cookie = 'breeze_locale=; Max-Age=0; Path=/';
  });

  it('renders Russian list controls, columns, and action labels', () => {
    const ring = makeRing();
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    render(<UpdateRingList rings={[ring]} onEdit={onEdit} onDelete={onDelete} />);

    expect(screen.getByRole('heading', { name: 'Кольца обновлений' })).toBeInTheDocument();
    expect(screen.getByText('1 из 1 колец')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Поиск колец...')).toBeInTheDocument();
    expect(screen.getByText('Порядок')).toBeInTheDocument();
    expect(screen.getByText('Кольцо')).toBeInTheDocument();
    expect(screen.getByText('Отсрочка')).toBeInTheDocument();
    expect(screen.getByText('Крайний срок')).toBeInTheDocument();
    expect(screen.getByText('Устройства')).toBeInTheDocument();
    expect(screen.getByText('Соответствие')).toBeInTheDocument();
    expect(screen.getByText('Обновлено')).toBeInTheDocument();
    expect(screen.getByText('7 дн.')).toBeInTheDocument();
    expect(screen.getByText('14 дн.')).toBeInTheDocument();
    expect(screen.getByText('95%')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Редактировать Pilot' }));
    expect(onEdit).toHaveBeenCalledWith(ring);
    fireEvent.click(screen.getByRole('button', { name: 'Удалить Pilot' }));
    expect(onDelete).toHaveBeenCalledWith(ring);
  });

  it('renders a Russian empty state', () => {
    render(<UpdateRingList rings={[]} />);

    expect(screen.getByText('Кольца обновлений не найдены.')).toBeInTheDocument();
  });
});
