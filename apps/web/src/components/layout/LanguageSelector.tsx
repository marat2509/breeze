import { Languages } from 'lucide-react';
import type { ChangeEvent } from 'react';
import { useState } from 'react';
import { createLocaleCookie, getLocaleDisplayName, type Locale, SUPPORTED_LOCALES } from '../../i18n/locales';
import { emitLocaleChange, useI18n } from '../../i18n/react';
import { translate } from '../../i18n/resources';
import { fetchWithAuth, useAuthStore } from '../../stores/auth';

interface LanguageSelectorProps {
  locale?: Locale;
  compact?: boolean;
}

export default function LanguageSelector({ locale: initialLocale = 'en', compact = false }: LanguageSelectorProps) {
  const { locale, setLocale, t } = useI18n(initialLocale);
  const [isSaving, setIsSaving] = useState(false);
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const handleChange = async (event: ChangeEvent<HTMLSelectElement>) => {
    const next = event.target.value as Locale;
    setLocale(next);
    document.cookie = createLocaleCookie(next);
    emitLocaleChange(next);

    if (!isAuthenticated) return;

    setIsSaving(true);
    try {
      await fetchWithAuth('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({
          preferences: {
            ...(user?.preferences ?? {}),
            locale: next,
          },
        }),
      });
    } catch (error) {
      console.warn('[LanguageSelector] Failed to persist locale preference:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <label className={compact ? 'inline-flex items-center gap-2 text-sm' : 'flex items-center gap-2 text-sm'}>
      <span className="sr-only">{t('locale.selectLabel')}</span>
      {!compact && <Languages className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
      <select
        aria-label={translate(locale, 'locale.selectLabel')}
        value={locale}
        onChange={handleChange}
        disabled={isSaving}
        className="h-9 rounded-md border bg-background px-2 text-sm text-foreground disabled:opacity-60"
      >
        {SUPPORTED_LOCALES.map((option) => (
          <option key={option} value={option}>
            {getLocaleDisplayName(option, locale)}
          </option>
        ))}
      </select>
    </label>
  );
}
