import { describe, expect, it } from 'vitest';
import { translatePageTitle } from './pageTitles';

describe('page title translations', () => {
  it('translates known DashboardLayout titles', () => {
    expect(translatePageTitle('ru', 'Dashboard')).toBe('Панель');
    expect(translatePageTitle('ru', 'Device Details')).toBe('Сведения об устройстве');
    expect(translatePageTitle('ru', 'API Keys')).toBe('API-ключи');
  });

  it('keeps unknown titles unchanged', () => {
    expect(translatePageTitle('ru', 'Custom customer name')).toBe('Custom customer name');
  });
});
