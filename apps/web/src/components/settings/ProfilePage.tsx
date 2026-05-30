import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import ChangePasswordForm from './ChangePasswordForm';
import MFASettings from './MFASettings';
import { fetchWithAuth } from '../../stores/auth';
import { navigateTo } from '@/lib/navigation';
import type { Locale } from '../../i18n/locales';
import { useI18n } from '../../i18n/react';
import { translate } from '../../i18n/resources';
import LanguageSelector from '../layout/LanguageSelector';

function buildProfileSchema(locale: Locale) {
  return z.object({
    name: z.string().min(2, translate(locale, 'profile.nameTooShort')),
    avatarUrl: z
      .string()
      .max(2048, translate(locale, 'profile.avatarTooLong'))
      .refine(
        (value) => value.trim() === '' || /^https?:\/\//i.test(value.trim()),
        translate(locale, 'profile.avatarInvalid')
      )
      .optional()
  });
}

type ProfileFormValues = z.infer<ReturnType<typeof buildProfileSchema>>;

type User = {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  mfaEnabled?: boolean;
};

type ProfilePageProps = {
  initialUser?: User;
  locale?: Locale;
};

export default function ProfilePage({ initialUser, locale: initialLocale = 'en' }: ProfilePageProps) {
  const { locale, t } = useI18n(initialLocale);
  const profileSchema = useMemo(() => buildProfileSchema(locale), [locale]);
  const [user, setUser] = useState<User | null>(initialUser ?? null);
  const [isLoadingUser, setIsLoadingUser] = useState(!initialUser);
  const [profileError, setProfileError] = useState<string | undefined>();
  const [profileSuccess, setProfileSuccess] = useState<string | undefined>();
  const [tourResetMsg, setTourResetMsg] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [passwordSuccess, setPasswordSuccess] = useState<string | undefined>();
  const [mfaError, setMfaError] = useState<string | undefined>();
  const [mfaSuccess, setMfaSuccess] = useState<string | undefined>();
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | undefined>();
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | undefined>();
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [mfaLoading, setMfaLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name ?? '',
      avatarUrl: user?.avatarUrl ?? ''
    }
  });

  const isProfileLoading = useMemo(
    () => isUpdatingProfile || isSubmitting,
    [isUpdatingProfile, isSubmitting]
  );
  const previewAvatarUrl = watch('avatarUrl')?.trim() || user?.avatarUrl || '';

  // Fetch user data on mount
  useEffect(() => {
    if (initialUser) {
      return;
    }

    const fetchUser = async () => {
      try {
        setIsLoadingUser(true);
        const response = await fetchWithAuth('/users/me');
        if (!response.ok) {
          if (response.status === 401) {
            void navigateTo('/login', { replace: true });
            return;
          }
          throw new Error(t('profile.failedToLoad'));
        }
        const userData = await response.json();
        setUser(userData);
        reset({
          name: userData.name ?? '',
          avatarUrl: userData.avatarUrl ?? ''
        });
      } catch {
        setProfileError(t('profile.failedToLoad'));
      } finally {
        setIsLoadingUser(false);
      }
    };

    fetchUser();
  }, [initialUser, reset, t]);

  const clearMessages = useCallback(() => {
    setProfileError(undefined);
    setProfileSuccess(undefined);
  }, []);

  const handleProfileSubmit = async (values: ProfileFormValues) => {
    clearMessages();
    try {
      setIsUpdatingProfile(true);
      const payload = {
        name: values.name.trim(),
        avatarUrl: values.avatarUrl?.trim() ?? ''
      };

      const response = await fetchWithAuth('/users/me', {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message ?? t('profile.failedToUpdate'));
      }

      const updatedUser = await response.json();
      setUser(updatedUser);
      reset({
        name: updatedUser.name ?? '',
        avatarUrl: updatedUser.avatarUrl ?? ''
      });
      setProfileSuccess(t('profile.updated'));
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : t('profile.failedToUpdate'));
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handlePasswordChange = async (values: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) => {
    setPasswordError(undefined);
    setPasswordSuccess(undefined);
    try {
      setIsChangingPassword(true);
      const response = await fetchWithAuth('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: values.currentPassword,
          newPassword: values.newPassword
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message ?? t('changePassword.failed'));
      }

      setPasswordSuccess(t('changePassword.changed'));
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : t('changePassword.failed'));
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleMfaRequestSetup = async (currentPassword: string): Promise<boolean> => {
    setMfaError(undefined);
    setMfaSuccess(undefined);
    // Clear any QR code from a prior aborted attempt before issuing a new one.
    setQrCodeDataUrl(undefined);
    try {
      setMfaLoading(true);
      const response = await fetchWithAuth('/auth/mfa/setup', {
        method: 'POST',
        body: JSON.stringify({ currentPassword })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error ?? errorData.message ?? `${t('mfa.setupFailed')} (HTTP ${response.status})`
        );
      }

      const data = await response.json();
      setQrCodeDataUrl(data.qrCodeDataUrl);
      return true;
    } catch (error) {
      setMfaError(error instanceof Error ? error.message : t('mfa.setupFailed'));
      return false;
    } finally {
      setMfaLoading(false);
    }
  };

  const handleMfaEnable = async (code: string, currentPassword: string) => {
    setMfaError(undefined);
    setMfaSuccess(undefined);
    try {
      setMfaLoading(true);
      const response = await fetchWithAuth('/auth/mfa/enable', {
        method: 'POST',
        body: JSON.stringify({ code, currentPassword })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error ?? errorData.message ?? `${t('mfa.enableFailed')} (HTTP ${response.status})`
        );
      }

      const data = await response.json();
      setUser(prev => (prev ? { ...prev, mfaEnabled: true } : null));
      setRecoveryCodes(data.recoveryCodes);
      setMfaSuccess(t('mfa.enabledSuccess'));
      setQrCodeDataUrl(undefined);
    } catch (error) {
      setMfaError(error instanceof Error ? error.message : t('mfa.enableFailed'));
    } finally {
      setMfaLoading(false);
    }
  };

  const handleMfaDisable = async (code: string, currentPassword: string) => {
    setMfaError(undefined);
    setMfaSuccess(undefined);
    try {
      setMfaLoading(true);
      const response = await fetchWithAuth('/auth/mfa/disable', {
        method: 'POST',
        body: JSON.stringify({ code, currentPassword })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error ?? errorData.message ?? `${t('mfa.disableFailed')} (HTTP ${response.status})`
        );
      }

      setUser(prev => (prev ? { ...prev, mfaEnabled: false } : null));
      setRecoveryCodes(undefined);
      setMfaSuccess(t('mfa.disabledSuccess'));
    } catch (error) {
      setMfaError(error instanceof Error ? error.message : t('mfa.disableFailed'));
    } finally {
      setMfaLoading(false);
    }
  };

  const handleGenerateRecoveryCodes = async (currentPassword: string) => {
    setMfaError(undefined);
    setMfaSuccess(undefined);
    try {
      setMfaLoading(true);
      const response = await fetchWithAuth('/auth/mfa/recovery-codes', {
        method: 'POST',
        body: JSON.stringify({ currentPassword })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message ?? t('mfa.recoveryFailed'));
      }

      const data = await response.json();
      setRecoveryCodes(data.recoveryCodes);
      setMfaSuccess(t('mfa.recoveryGenerated'));
    } catch (error) {
      setMfaError(error instanceof Error ? error.message : t('mfa.recoveryFailed'));
    } finally {
      setMfaLoading(false);
    }
  };

  if (isLoadingUser) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-sm text-muted-foreground">{t('profile.loading')}</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t('profile.title')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('profile.description')}
        </p>
      </div>

      {/* Profile Information */}
      <form
        onSubmit={handleSubmit(handleProfileSubmit)}
        className="space-y-6 rounded-lg border bg-card p-6 shadow-sm"
      >
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">{t('profile.information')}</h2>
          <p className="text-sm text-muted-foreground">{t('profile.updatePersonalDetails')}</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-lg font-medium text-muted-foreground">
            {previewAvatarUrl ? (
              <img
                src={previewAvatarUrl}
                alt={user?.name ?? t('profile.userAvatar')}
                className="h-16 w-16 rounded-full object-cover"
              />
            ) : (
              user?.name?.charAt(0).toUpperCase() ?? '?'
            )}
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">{t('profile.avatar')}</p>
            <p className="text-xs text-muted-foreground">
              {t('profile.avatarHint')}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="avatarUrl" className="text-sm font-medium">
            {t('profile.avatarImageUrl')}
          </label>
          <input
            id="avatarUrl"
            type="url"
            autoComplete="url"
            placeholder={t('profile.avatarPlaceholder')}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            {...register('avatarUrl')}
          />
          {errors.avatarUrl && <p className="text-sm text-destructive">{errors.avatarUrl.message}</p>}
        </div>

        <div className="space-y-2">
          <label htmlFor="name" className="text-sm font-medium">
            {t('profile.name')}
          </label>
          <input
            id="name"
            type="text"
            autoComplete="name"
            placeholder={t('profile.namePlaceholder')}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            {...register('name')}
          />
          {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
        </div>

        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium">
            {t('profile.email')}
          </label>
          <input
            id="email"
            type="email"
            value={user?.email ?? ''}
            disabled
            className="h-10 w-full rounded-md border bg-muted px-3 text-sm text-muted-foreground"
          />
          <p className="text-xs text-muted-foreground">
            {t('profile.emailLocked')}
          </p>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">
            {t('common.language')}
          </div>
          <LanguageSelector locale={locale} />
        </div>

        {profileError && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {profileError}
          </div>
        )}

        {profileSuccess && (
          <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600">
            {profileSuccess}
          </div>
        )}

        <button
          type="submit"
          disabled={isProfileLoading}
          className="flex h-11 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isProfileLoading ? t('common.saving') : t('common.saveChanges')}
        </button>
      </form>

      {/* Change Password */}
      <ChangePasswordForm
        onSubmit={handlePasswordChange}
        errorMessage={passwordError}
        successMessage={passwordSuccess}
        loading={isChangingPassword}
        locale={locale}
      />

      {/* MFA Settings */}
      <MFASettings
        enabled={user?.mfaEnabled ?? false}
        qrCodeDataUrl={qrCodeDataUrl}
        recoveryCodes={recoveryCodes}
        onRequestSetup={handleMfaRequestSetup}
        onEnable={handleMfaEnable}
        onDisable={handleMfaDisable}
        onGenerateRecoveryCodes={handleGenerateRecoveryCodes}
        errorMessage={mfaError}
        successMessage={mfaSuccess}
        loading={mfaLoading}
        locale={locale}
      />

      {/* Onboarding */}
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">{t('profile.onboarding')}</h2>
        <p className="text-sm text-muted-foreground mt-1 mb-4">
          {t('profile.onboardingDescription')}
        </p>
        {tourResetMsg && (
          <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 mb-3">
            {tourResetMsg}
          </div>
        )}
        <button
          type="button"
          onClick={() => {
            try {
              localStorage.removeItem('breeze-onboarding-complete');
              setTourResetMsg(t('profile.tourReset'));
              setTimeout(() => setTourResetMsg(undefined), 4000);
            } catch { /* ignore */ }
          }}
          className="rounded-md border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
        >
          {t('profile.restartTour')}
        </button>
      </div>
    </div>
  );
}
