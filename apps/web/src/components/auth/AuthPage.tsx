import { useEffect, useState } from 'react';
import LoginPage from './LoginPage';
import PartnerRegisterPage from './PartnerRegisterPage';
import type { Locale } from '../../i18n/locales';
import { useI18n } from '../../i18n/react';

interface AuthPageProps {
  next?: string;
  locale?: Locale;
}

type Tab = 'signin' | 'signup';

function getInitialTab(): Tab {
  if (typeof window === 'undefined') return 'signin';
  return window.location.hash === '#signup' ? 'signup' : 'signin';
}

export default function AuthPage({ next, locale: initialLocale = 'en' }: AuthPageProps) {
  const { locale, t } = useI18n(initialLocale);
  const [tab, setTab] = useState<Tab>(getInitialTab);

  useEffect(() => {
    const onHashChange = () => {
      setTab(window.location.hash === '#signup' ? 'signup' : 'signin');
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const handleTabChange = (newTab: Tab) => {
    window.location.hash = newTab;
    setTab(newTab);
  };

  return (
    <div data-testid="auth-page">
      <div className="mb-6 flex rounded-lg border bg-muted/40 p-1" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'signin'}
          data-testid="tab-signin"
          onClick={() => handleTabChange('signin')}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition ${
            tab === 'signin' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {t('auth.signIn')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'signup'}
          data-testid="tab-signup"
          onClick={() => handleTabChange('signup')}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition ${
            tab === 'signup' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {t('auth.createAccount')}
        </button>
      </div>

      {tab === 'signin' ? (
        <LoginPage next={next} locale={locale} />
      ) : (
        <PartnerRegisterPage next={next} />
      )}
    </div>
  );
}
