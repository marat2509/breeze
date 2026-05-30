import { useState } from 'react';
import LoginForm from './LoginForm';
import MFAVerifyForm from './MFAVerifyForm';
import McpUrlCard from '../shared/McpUrlCard';
import { useAuthStore, apiLogin, apiVerifyMFA, apiSendSmsMfaCode, fetchAndApplyPreferences } from '../../stores/auth';
import type { MfaMethod } from '../../stores/auth';
import { navigateTo } from '../../lib/navigation';
import { getSafeNext } from '../../lib/authNext';
import type { Locale } from '../../i18n/locales';
import { useI18n } from '../../i18n/react';
import { translate } from '../../i18n/resources';

function getRegistrationDisabledNotice(locale: Locale): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const params = new URLSearchParams(window.location.search);
  if (params.get('reason') === 'registration-disabled') {
    return translate(locale, 'auth.registrationDisabled');
  }
}

interface LoginPageProps {
  next?: string;
  locale?: Locale;
}

export default function LoginPage({ next, locale: initialLocale = 'en' }: LoginPageProps = {}) {
  const { locale, t } = useI18n(initialLocale);
  const safeNext = getSafeNext(next);
  const [error, setError] = useState<string>();
  const registrationNotice = getRegistrationDisabledNotice(locale);
  const [loading, setLoading] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [tempToken, setTempToken] = useState<string>();
  const [mfaMethod, setMfaMethod] = useState<MfaMethod>('totp');
  const [phoneLast4, setPhoneLast4] = useState<string>();
  const [smsSending, setSmsSending] = useState(false);
  const [smsSent, setSmsSent] = useState(false);

  const login = useAuthStore((state) => state.login);

  const handleLogin = async (values: { email: string; password: string }) => {
    setLoading(true);
    setError(undefined);

    const result = await apiLogin(values.email, values.password);

    if (!result.success) {
      setError(result.error);
      setLoading(false);
      return;
    }

    if (result.mfaRequired) {
      setMfaRequired(true);
      setTempToken(result.tempToken);
      setMfaMethod(result.mfaMethod || 'totp');
      setPhoneLast4(result.phoneLast4);
      setSmsSent(false);
      setLoading(false);
      return;
    }

    if (result.user && result.tokens) {
      login(result.user, result.tokens);
      fetchAndApplyPreferences();
      // Setup wizard wins over `next` — user can't do anything useful before setup completes.
      await navigateTo(result.requiresSetup ? '/setup' : safeNext);
      return;
    }

    setLoading(false);
  };

  const handleMfaVerify = async (code: string) => {
    if (!tempToken) return;

    setLoading(true);
    setError(undefined);

    const result = await apiVerifyMFA(code, tempToken, mfaMethod);

    if (!result.success) {
      setError(result.error);
      setLoading(false);
      return;
    }

    if (result.user && result.tokens) {
      login(result.user, result.tokens);
      fetchAndApplyPreferences();
      // Setup wizard wins over `next` — user can't do anything useful before setup completes.
      await navigateTo(result.requiresSetup ? '/setup' : safeNext);
      return;
    }

    setLoading(false);
  };

  const handleSendSmsCode = async () => {
    if (!tempToken) return;

    setSmsSending(true);
    setError(undefined);

    const result = await apiSendSmsMfaCode(tempToken);

    if (!result.success) {
      setError(result.error);
    } else {
      setSmsSent(true);
    }

    setSmsSending(false);
  };

  if (mfaRequired) {
    return (
      <div>
        <div className="mb-8">
          <p className="text-sm font-medium text-muted-foreground">{t('auth.almostThere')}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{t('auth.verifyIdentity')}</h1>
        </div>
        <MFAVerifyForm
          onSubmit={handleMfaVerify}
          errorMessage={error}
          loading={loading}
          mfaMethod={mfaMethod}
          phoneLast4={phoneLast4}
          onSendSmsCode={handleSendSmsCode}
          smsSending={smsSending}
          smsSent={smsSent}
          locale={locale}
        />
      </div>
    );
  }

  return (
    <div data-testid="login-page">
      <div className="mb-8">
        <p className="text-sm font-medium text-muted-foreground">{t('auth.welcomeBack')}</p>
        <h1 data-testid="login-heading" className="mt-1 text-2xl font-bold tracking-tight">{t('auth.signInToBreeze')}</h1>
      </div>

      {registrationNotice && (
        <div className="mb-6 rounded-md border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 dark:border-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-200">
          {registrationNotice}
        </div>
      )}
      <LoginForm
        onSubmit={handleLogin}
        errorMessage={error}
        loading={loading}
        locale={locale}
      />
      <McpUrlCard variant="compact" requireOAuth className="mt-8" />
    </div>
  );
}
