import { useCallback, useEffect, useMemo, useState } from 'react';
import { Smartphone, Loader2, ShieldAlert, AlertTriangle, X, ArrowLeft } from 'lucide-react';
import { fetchWithAuth } from '../../stores/auth';
import { showToast } from '../shared/Toast';
import AccountSubNav from './AccountSubNav';
import { formatAbsolute, formatRelative } from './relativeTime';
import { useI18n } from '@/i18n/react';

interface MobileDevice {
  id: string;
  deviceId: string;
  platform: string | null;
  model: string | null;
  osVersion: string | null;
  appVersion: string | null;
  lastActiveAt: string | null;
  status: 'active' | 'blocked';
  blockedAt: string | null;
  blockedReason: string | null;
  createdAt: string;
  isCurrent: boolean;
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; devices: MobileDevice[] };

interface ConfirmState {
  device: MobileDevice;
  reason: string;
  isOnly: boolean;
}

function platformLabel(p: string | null, t: ReturnType<typeof useI18n>['t']): string {
  if (!p) return t('account.mobileDevices.unknownDevice');
  if (p.toLowerCase() === 'ios') return 'iOS';
  if (p.toLowerCase() === 'android') return 'Android';
  return p;
}

function deviceTitle(d: MobileDevice, t: ReturnType<typeof useI18n>['t']): string {
  if (d.model && d.model.trim().length > 0) return d.model;
  return platformLabel(d.platform, t);
}

export default function MobileDevicesPage() {
  const { locale, t } = useI18n();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [revoking, setRevoking] = useState(false);

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const res = await fetchWithAuth('/me/mobile-devices');
      if (!res.ok) {
        setState({ kind: 'error', message: t('account.common.requestFailed', { status: String(res.status) }) });
        return;
      }
      const body = (await res.json()) as { devices: MobileDevice[] };
      setState({ kind: 'ready', devices: body.devices ?? [] });
    } catch {
      setState({ kind: 'error', message: t('account.common.networkError') });
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeDevices = useMemo(
    () => (state.kind === 'ready' ? state.devices.filter((d) => d.status === 'active') : []),
    [state]
  );

  const handleRevokeClick = (device: MobileDevice) => {
    if (device.status !== 'active') return;
    setConfirm({
      device,
      reason: '',
      isOnly: activeDevices.length <= 1,
    });
  };

  const handleConfirm = async () => {
    if (!confirm) return;
    setRevoking(true);
    try {
      const res = await fetchWithAuth(`/me/mobile-devices/${encodeURIComponent(confirm.device.id)}/block`, {
        method: 'POST',
        body: JSON.stringify({ reason: confirm.reason.trim().length > 0 ? confirm.reason.trim() : undefined }),
      });
      if (res.status !== 204 && !res.ok) {
        showToast({ type: 'error', message: t('account.mobileDevices.errors.revokeFailed', { status: String(res.status) }) });
        return;
      }
      showToast({ type: 'success', message: t('account.mobileDevices.revokedToast') });
      setConfirm(null);
      await load();
    } catch {
      showToast({ type: 'error', message: t('account.mobileDevices.errors.revokeNetwork') });
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      <header className="space-y-2">
        <a
          href="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('account.common.backToDashboard')}
        </a>
        <h1 className="text-2xl font-semibold tracking-tight">{t('account.mobileDevices.title')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('account.mobileDevices.description')}
        </p>
      </header>

      <AccountSubNav current="devices" />

      {state.kind === 'loading' && (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
        </div>
      )}

      {state.kind === 'error' && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <ShieldAlert className="mt-0.5 h-4 w-4 flex-none" aria-hidden />
          <div className="flex-1 space-y-2">
            <p>{state.message}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-md border border-destructive/40 px-3 py-1 text-xs font-medium hover:bg-destructive/5"
            >
              {t('account.common.tryAgain')}
            </button>
          </div>
        </div>
      )}

      {state.kind === 'ready' && state.devices.length === 0 && (
        <div className="rounded-lg border border-dashed bg-muted/30 p-8 text-center">
          <Smartphone className="mx-auto h-10 w-10 text-muted-foreground/40" aria-hidden />
          <h2 className="mt-4 text-base font-semibold">{t('account.mobileDevices.emptyTitle')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('account.mobileDevices.emptyDescription')}
          </p>
        </div>
      )}

      {state.kind === 'ready' && state.devices.length > 0 && (
        <div className="overflow-hidden rounded-lg border bg-card">
          <ul className="divide-y">
            {state.devices.map((device) => {
              const isActive = device.status === 'active';
              return (
                <li key={device.id} className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Smartphone className="h-4 w-4 text-muted-foreground" aria-hidden />
                        <span className="font-medium">{deviceTitle(device, t)}</span>
                        {device.isCurrent && (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                            {t('account.mobileDevices.thisDevice')}
                          </span>
                        )}
                        {isActive ? (
                          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                            {t('account.common.active')}
                          </span>
                        ) : (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                            {t('account.mobileDevices.blocked')}
                          </span>
                        )}
                      </div>
                      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        <dt>{t('account.mobileDevices.platform')}</dt>
                        <dd>
                          {platformLabel(device.platform, t)}
                          {device.osVersion ? ` ${device.osVersion}` : ''}
                          {device.appVersion ? ` · ${t('account.mobileDevices.appVersion', { version: device.appVersion })}` : ''}
                        </dd>
                        <dt>{t('account.mobileDevices.lastActive')}</dt>
                        <dd title={formatAbsolute(device.lastActiveAt, locale)}>
                          {formatRelative(device.lastActiveAt, locale)}
                        </dd>
                        {!isActive && (
                          <>
                            <dt>{t('account.mobileDevices.blocked')}</dt>
                            <dd title={formatAbsolute(device.blockedAt, locale)}>
                              {formatRelative(device.blockedAt, locale)}
                              {device.blockedReason ? ` · ${device.blockedReason}` : ''}
                            </dd>
                          </>
                        )}
                      </dl>
                    </div>
                    {isActive && (
                      <button
                        type="button"
                        onClick={() => handleRevokeClick(device)}
                        disabled={device.isCurrent}
                        title={device.isCurrent ? t('account.mobileDevices.revokeFromAnother') : undefined}
                        className="inline-flex h-9 items-center justify-center rounded-md border border-destructive/40 px-3 text-sm font-medium text-destructive transition hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {t('account.common.revoke')}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {confirm && (
        <RevokeConfirmDialog
          state={confirm}
          revoking={revoking}
          onChange={(reason) => setConfirm({ ...confirm, reason })}
          onCancel={() => (revoking ? null : setConfirm(null))}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  );
}

function RevokeConfirmDialog({
  state,
  revoking,
  onChange,
  onCancel,
  onConfirm,
}: {
  state: ConfirmState;
  revoking: boolean;
  onChange: (reason: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useI18n();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-4 py-8">
      <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden />
            </div>
            <h2 className="text-lg font-semibold">
              {t('account.mobileDevices.revokeTitle', { device: deviceTitle(state.device, t) })}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={revoking}
            className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted disabled:cursor-not-allowed"
            aria-label={t('common.dismiss')}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="mt-4 space-y-3 text-sm">
          <p className="text-muted-foreground">
            {t('account.mobileDevices.revokeDescription')}
          </p>
          {state.isOnly && (
            <div className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-amber-900 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" aria-hidden />
              <p>
                <strong>{t('account.mobileDevices.onlyDeviceStrong')}</strong>{' '}
                {t('account.mobileDevices.onlyDeviceDescription')}
              </p>
            </div>
          )}
          <label htmlFor="revoke-reason" className="block text-sm font-medium">
            {t('account.common.reasonOptional')}
          </label>
          <textarea
            id="revoke-reason"
            rows={2}
            value={state.reason}
            onChange={(e) => onChange(e.target.value)}
            maxLength={500}
            placeholder={t('account.mobileDevices.reasonPlaceholder')}
            className="w-full rounded-md border bg-background p-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={revoking}
            className="h-10 rounded-md border px-4 text-sm font-medium text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={revoking}
            className="inline-flex h-10 items-center justify-center rounded-md bg-destructive px-4 text-sm font-medium text-destructive-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {revoking ? (
              <>
                <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                {t('account.common.revoking')}
              </>
            ) : (
              t('account.mobileDevices.revokeDevice')
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
