import { describe, expect, it, vi } from 'vitest';
import { formatDate, formatNumber, formatRelativeTime } from './formatters';

describe('i18n formatters', () => {
  it('formats numbers using locale conventions', () => {
    expect(formatNumber(1234567.5, 'en')).toBe('1,234,567.5');
    expect(formatNumber(1234567.5, 'ru')).toContain('1');
    expect(formatNumber(1234567.5, 'ru')).toContain('567,5');
  });

  it('formats absolute dates using the requested locale', () => {
    const iso = '2026-05-30T10:20:00.000Z';
    expect(formatDate(iso, 'en', { timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric' })).toBe('May 30, 2026');
    expect(formatDate(iso, 'ru', { timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric' })).toContain('2026');
  });

  it('formats relative time in English and Russian', () => {
    vi.setSystemTime(new Date('2026-05-30T12:00:00.000Z'));
    expect(formatRelativeTime('2026-05-30T11:58:00.000Z', 'en')).toBe('2 minutes ago');
    expect(formatRelativeTime('2026-05-30T11:58:00.000Z', 'ru')).toBe('2 минуты назад');
    vi.useRealTimers();
  });
});
