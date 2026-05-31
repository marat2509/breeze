import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SourceFilterChips from './SourceFilterChips';

describe('SourceFilterChips', () => {
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

  it('renders one chip per source plus a localized "All" chip with the summed total', () => {
    render(
      <SourceFilterChips
        counts={{ microsoft: 3, apple: 2, linux: 1, third_party: 4, custom: 0 }}
        value="all"
        onChange={() => {}}
      />
    );

    expect(screen.getByTestId('patches-filter-all')).toBeTruthy();
    expect(screen.getByTestId('patches-filter-microsoft')).toBeTruthy();
    expect(screen.getByTestId('patches-filter-apple')).toBeTruthy();
    expect(screen.getByTestId('patches-filter-linux')).toBeTruthy();
    expect(screen.getByTestId('patches-filter-third_party')).toBeTruthy();

    expect(screen.getByTestId('patches-filter-all')).toHaveTextContent('Все');
    expect(screen.getByTestId('patches-filter-third_party')).toHaveTextContent('Сторонние');
    expect(screen.getByTestId('patches-count-all').textContent).toContain('10');
    expect(screen.getByTestId('patches-count-microsoft').textContent).toContain('3');
    expect(screen.getByTestId('patches-count-third_party').textContent).toContain('4');
  });

  it('fires onChange with the clicked source', () => {
    const onChange = vi.fn();
    render(
      <SourceFilterChips
        counts={{ microsoft: 3, apple: 2, linux: 1, third_party: 4, custom: 0 }}
        value="all"
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByTestId('patches-filter-third_party'));
    expect(onChange).toHaveBeenCalledWith('third_party');

    fireEvent.click(screen.getByTestId('patches-filter-microsoft'));
    expect(onChange).toHaveBeenCalledWith('microsoft');
  });
});
