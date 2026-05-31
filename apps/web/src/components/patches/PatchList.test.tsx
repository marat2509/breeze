import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import PatchList, { type Patch } from './PatchList';

function makePatch(overrides: Partial<Patch> = {}): Patch {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    title: 'Example Patch',
    severity: 'important',
    source: 'third_party',
    os: 'windows',
    releaseDate: '2026-02-07',
    approvalStatus: 'pending',
    ...overrides,
  };
}

describe('PatchList CVE chips', () => {
  beforeEach(() => {
    const data = new Map<string, string>();
    Object.defineProperty(window, 'localStorage', {
      value: {
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
      },
      writable: true,
      configurable: true,
    });
    window.localStorage.setItem('breeze_locale', 'ru');
    document.cookie = 'breeze_locale=; Max-Age=0; Path=/';
  });

  it('renders Russian list controls, table labels, and row badges', () => {
    const patch = makePatch({
      severity: 'critical',
      approvalStatus: 'approved',
      vendor: 'Acme',
      description: 'Driver package update',
    });

    render(<PatchList patches={[patch]} />);

    expect(screen.getByRole('heading', { name: 'Патчи' })).toBeInTheDocument();
    expect(screen.getByText('1 из 1 патчей')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Поиск патчей...')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Все уровни')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Все статусы')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Больше фильтров' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Выбрать все патчи' })).toBeInTheDocument();

    expect(screen.getByText('Уровень')).toBeInTheDocument();
    expect(screen.getByText('Источник')).toBeInTheDocument();
    expect(screen.getByText('Выпуск')).toBeInTheDocument();
    expect(screen.getByText('Решение')).toBeInTheDocument();
    expect(screen.getByText('Действия')).toBeInTheDocument();
    expect(screen.getAllByText('Критический').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Одобрено').length).toBeGreaterThan(0);
    expect(screen.getByText('от Acme')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Развернуть' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Подробнее' })).toBeInTheDocument();
  });

  it('renders one chip per cveId (up to 3)', () => {
    const patch = makePatch({
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      cveIds: ['CVE-2024-1234', 'CVE-2024-5678'],
    });

    render(<PatchList patches={[patch]} />);

    expect(screen.getByTestId(`patch-row-${patch.id}-cve-CVE-2024-1234`)).toBeTruthy();
    expect(screen.getByTestId(`patch-row-${patch.id}-cve-CVE-2024-5678`)).toBeTruthy();
  });

  it('caps visible CVEs at 3 and shows a "+N more" suffix', () => {
    const patch = makePatch({
      id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      cveIds: ['CVE-2024-1', 'CVE-2024-2', 'CVE-2024-3', 'CVE-2024-4', 'CVE-2024-5'],
    });

    render(<PatchList patches={[patch]} />);

    expect(screen.getByTestId(`patch-row-${patch.id}-cve-CVE-2024-1`)).toBeTruthy();
    expect(screen.getByTestId(`patch-row-${patch.id}-cve-CVE-2024-2`)).toBeTruthy();
    expect(screen.getByTestId(`patch-row-${patch.id}-cve-CVE-2024-3`)).toBeTruthy();
    expect(screen.queryByTestId(`patch-row-${patch.id}-cve-CVE-2024-4`)).toBeNull();
    expect(screen.getByText('+2 ещё')).toBeTruthy();
  });

  it('renders no CVE chips when cveIds is empty or missing', () => {
    const empty = makePatch({ id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', cveIds: [] });
    const missing = makePatch({ id: 'dddddddd-dddd-dddd-dddd-dddddddddddd' });

    const { container, rerender } = render(<PatchList patches={[empty]} />);
    expect(container.querySelector('[data-testid^="patch-row-"][data-testid*="-cve-"]')).toBeNull();

    rerender(<PatchList patches={[missing]} />);
    expect(container.querySelector('[data-testid^="patch-row-"][data-testid*="-cve-"]')).toBeNull();
  });
});
