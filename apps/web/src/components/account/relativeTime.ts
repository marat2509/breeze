import type { Locale } from '@/i18n/locales';

const fallback = {
  en: { never: 'Never', unknown: 'Unknown', moment: 'in a moment', now: 'just now' },
  ru: { never: 'Никогда', unknown: 'Неизвестно', moment: 'скоро', now: 'только что' },
} satisfies Record<Locale, Record<string, string>>;

// Minimal relative-time helper for lifecycle pages. Picks the largest unit
// that fits and rounds; falls back to a locale date for anything older than
// ~1 month.
export function formatRelative(input: string | null | undefined, locale: Locale = 'en'): string {
  if (!input) return fallback[locale].never;
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return fallback[locale].unknown;

  const diffMs = Date.now() - date.getTime();
  const future = diffMs < 0;
  const abs = Math.abs(diffMs);
  const sec = Math.round(abs / 1000);
  if (sec < 45) return future ? fallback[locale].moment : fallback[locale].now;
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const min = Math.round(sec / 60);
  if (min < 60) return formatter.format(future ? min : -min, 'minute');
  const hr = Math.round(min / 60);
  if (hr < 24) return formatter.format(future ? hr : -hr, 'hour');
  const day = Math.round(hr / 24);
  if (day < 30) return formatter.format(future ? day : -day, 'day');
  return date.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatAbsolute(input: string | null | undefined, locale: Locale = 'en'): string {
  if (!input) return '—';
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
