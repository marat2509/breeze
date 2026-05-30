import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { ENABLE_REGISTRATION } from '../../lib/featureFlags';
import type { Locale } from '../../i18n/locales';
import { translate } from '../../i18n/resources';

function buildLoginSchema(locale: Locale) {
  return z.object({
    email: z.string().email(translate(locale, 'auth.invalidEmail')),
    password: z.string().min(8, translate(locale, 'auth.shortPassword'))
  });
}

type LoginFormValues = z.infer<ReturnType<typeof buildLoginSchema>>;

type LoginFormProps = {
  onSubmit?: (values: LoginFormValues) => void | Promise<void>;
  errorMessage?: string;
  submitLabel?: string;
  loading?: boolean;
  locale?: Locale;
};

export default function LoginForm({
  onSubmit,
  errorMessage,
  submitLabel,
  loading,
  locale = 'en'
}: LoginFormProps) {
  const loginSchema = useMemo(() => buildLoginSchema(locale), [locale]);
  const t = (key: string) => translate(locale, key);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: ''
    }
  });

  const isLoading = useMemo(() => loading ?? isSubmitting, [loading, isSubmitting]);

  return (
    <form
      onSubmit={handleSubmit(async values => {
        await onSubmit?.(values);
      })}
      className="space-y-6"
    >
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium">
          {t('auth.email')}
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          placeholder={t('auth.emailPlaceholder')}
          data-testid="login-email-input"
          className="h-10 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          {...register('email')}
        />
        {errors.email && (
          <p data-testid="login-email-error" className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="text-sm font-medium">
            {t('auth.password')}
          </label>
          <a href="/forgot-password" className="text-sm text-primary hover:underline">
            {t('auth.forgotPassword')}
          </a>
        </div>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          placeholder={t('auth.passwordPlaceholder')}
          data-testid="login-password-input"
          className="h-10 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          {...register('password')}
        />
        {errors.password && (
          <p data-testid="login-password-error" className="text-sm text-destructive">{errors.password.message}</p>
        )}
      </div>

      {errorMessage && (
        <div
          data-testid="login-error"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {errorMessage}
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading}
        data-testid="login-submit"
        className="flex h-11 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading ? t('auth.signingIn') : submitLabel ?? t('auth.signIn')}
      </button>

      {ENABLE_REGISTRATION && (
        <div className="space-y-2 text-center text-sm text-muted-foreground">
          <p>
            {t('auth.newHere')}{' '}
            <a href="/register-partner" className="font-medium text-primary hover:underline">
              {t('auth.registerMsp')}
            </a>
          </p>
        </div>
      )}
    </form>
  );
}
