import { describe, expect, it } from 'vitest';
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
  it('keeps Russian keys in parity with English', () => {
    const enKeys = Object.keys(flatten(resources.en)).sort();
    const ruKeys = Object.keys(flatten(resources.ru)).sort();

    expect(ruKeys).toEqual(enKeys);
  });

  it('keeps interpolation tokens in parity', () => {
    const en = flatten(resources.en);
    const ru = flatten(resources.ru);

    for (const key of Object.keys(en)) {
      expect(interpolationTokens(ru[key]), key).toEqual(interpolationTokens(en[key]));
    }
  });
});
