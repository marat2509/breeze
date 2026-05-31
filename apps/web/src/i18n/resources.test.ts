import { describe, expect, it } from 'vitest';
import { SUPPORTED_LOCALES } from './locales';
import { resources } from './resources';

function flatten(value: unknown, prefix = ''): Record<string, string> {
  if (!value || typeof value !== 'object') return {};
  return Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>((acc, [key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof child === 'string') {
      acc[path] = child;
    } else {
      Object.assign(acc, flatten(child, path));
    }
    return acc;
  }, {});
}

const interpolationTokens = (value: string): string[] =>
  [...value.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map(match => match[1]).sort();

describe('i18n resources', () => {
  it('ships resources for exactly the supported locales', () => {
    expect(Object.keys(resources).sort()).toEqual([...SUPPORTED_LOCALES].sort());
  });

  it('keeps localized keys in parity with English', () => {
    const enKeys = Object.keys(flatten(resources.en)).sort();

    for (const locale of SUPPORTED_LOCALES) {
      if (locale === 'en') continue;
      expect(Object.keys(flatten(resources[locale])).sort(), locale).toEqual(enKeys);
    }
  });

  it('keeps interpolation tokens in parity', () => {
    const en = flatten(resources.en);

    for (const locale of SUPPORTED_LOCALES) {
      if (locale === 'en') continue;
      const localized = flatten(resources[locale]);
      for (const key of Object.keys(en)) {
        expect(interpolationTokens(localized[key]), `${locale}.${key}`).toEqual(interpolationTokens(en[key]));
      }
    }
  });
});
