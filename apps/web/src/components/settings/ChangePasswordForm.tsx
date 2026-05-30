import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { cn, widthPercentClass } from '@/lib/utils';
import type { Locale } from '../../i18n/locales';
import { useI18n } from '../../i18n/react';
import { translate } from '../../i18n/resources';

function buildChangePasswordSchema(locale: Locale) {
  return z
    .object({
      currentPassword: z.string().min(1, translate(locale, 'changePassword.currentRequired')),
      newPassword: z.string().min(8, translate(locale, 'auth.shortPassword')),
      confirmPassword: z.string().min(8, translate(locale, 'changePassword.confirmRequired'))
    })
    .refine(data => data.newPassword === data.confirmPassword, {
      message: translate(locale, 'changePassword.mismatch'),
      path: ['confirmPassword']
    })
    .refine(data => data.currentPassword !== data.newPassword, {
      message: translate(locale, 'changePassword.mustDiffer'),
      path: ['newPassword']
    });
}

type ChangePasswordFormValues = z.infer<ReturnType<typeof buildChangePasswordSchema>>;

type ChangePasswordFormProps = {
  onSubmit?: (values: ChangePasswordFormValues) => void | Promise<void>;
  errorMessage?: string;
  successMessage?: string;
  submitLabel?: string;
  loading?: boolean;
  locale?: Locale;
};

type StrengthConfig = {
  label: string;
  className: string;
  minScore: number;
};

const strengthScale: StrengthConfig[] = [
  { label: 'changePassword.tooWeak', className: 'bg-destructive', minScore: 0 },
  { label: 'changePassword.weak', className: 'bg-destructive/70', minScore: 2 },
  { label: 'changePassword.fair', className: 'bg-amber-500', minScore: 3 },
  { label: 'changePassword.good', className: 'bg-emerald-500', minScore: 4 },
  { label: 'changePassword.strong', className: 'bg-emerald-600', minScore: 5 }
];

function getStrengthScore(password: string) {
  let score = 0;

  if (password.length >= 8) {
    score += 1;
  }
  if (/[A-Z]/.test(password)) {
    score += 1;
  }
  if (/[a-z]/.test(password)) {
    score += 1;
  }
  if (/\d/.test(password)) {
    score += 1;
  }
  if (/[^A-Za-z0-9]/.test(password)) {
    score += 1;
  }

  return score;
}

export default function ChangePasswordForm({
  onSubmit,
  errorMessage,
  successMessage,
  submitLabel,
  loading,
  locale: initialLocale = 'en'
}: ChangePasswordFormProps) {
  const { locale, t } = useI18n(initialLocale);
  const changePasswordSchema = useMemo(() => buildChangePasswordSchema(locale), [locale]);
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    }
  });

  const isLoading = useMemo(() => loading ?? isSubmitting, [loading, isSubmitting]);
  const newPasswordValue = watch('newPassword');

  const strength = useMemo(() => {
    if (!newPasswordValue) {
      return {
        label: t('changePassword.enterPassword'),
        className: 'bg-muted',
        percent: 0
      };
    }

    const score = getStrengthScore(newPasswordValue);
    const tier = strengthScale
      .slice()
      .reverse()
      .find(item => score >= item.minScore);
    const percent = Math.min(100, Math.round((score / 5) * 100));
    const defaultTier = { label: 'changePassword.weak', className: 'bg-destructive', minScore: 0 };

    return {
      label: t(tier?.label ?? defaultTier.label),
      className: tier?.className ?? defaultTier.className,
      percent
    };
  }, [newPasswordValue, t]);

  const handleFormSubmit = async (values: ChangePasswordFormValues) => {
    await onSubmit?.(values);
    reset();
  };

  return (
    <form
      onSubmit={handleSubmit(handleFormSubmit)}
      className="space-y-6 rounded-lg border bg-card p-6 shadow-sm"
    >
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{t('changePassword.title')}</h2>
        <p className="text-sm text-muted-foreground">
          {t('changePassword.description')}
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="currentPassword" className="text-sm font-medium">
          {t('changePassword.currentPassword')}
        </label>
        <input
          id="currentPassword"
          type="password"
          autoComplete="current-password"
          placeholder={t('changePassword.currentPasswordPlaceholder')}
          className="h-10 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          {...register('currentPassword')}
        />
        {errors.currentPassword && (
          <p className="text-sm text-destructive">{errors.currentPassword.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <label htmlFor="newPassword" className="text-sm font-medium">
          {t('changePassword.newPassword')}
        </label>
        <input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          placeholder={t('changePassword.newPasswordPlaceholder')}
          className="h-10 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          {...register('newPassword')}
        />
        {errors.newPassword && (
          <p className="text-sm text-destructive">{errors.newPassword.message}</p>
        )}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{t('changePassword.passwordStrength')}</span>
            <span>{strength.label}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn('h-full transition-all', strength.className, widthPercentClass(strength.percent))}
              aria-hidden="true"
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="confirmPassword" className="text-sm font-medium">
          {t('changePassword.confirmPassword')}
        </label>
        <input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          placeholder={t('changePassword.confirmPasswordPlaceholder')}
          className="h-10 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          {...register('confirmPassword')}
        />
        {errors.confirmPassword && (
          <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
        )}
      </div>

      {errorMessage && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600">
          {successMessage}
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="flex h-11 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading ? t('changePassword.changing') : submitLabel ?? t('changePassword.submit')}
      </button>
    </form>
  );
}
