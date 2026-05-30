import { useCallback, useEffect, useState } from 'react';
import { Monitor, Cpu, Shield, Tag, Info, ListChecks, Pencil, Check, X, AlertTriangle } from 'lucide-react';
import type { DesktopAccessState, TCCPermissions } from '@breeze/shared';
import MacOSPermissionsCard from './MacOSPermissionsCard';
import { fetchWithAuth } from '../../stores/auth';
import { formatUptime } from '../../lib/utils';
import { runAction, ActionError } from '../../lib/runAction';
import {
  DEVICE_ROLES,
  getDeviceRoleLabel,
  getDeviceRoleIcon,
  getDeviceRoleSourceLabel,
  getDeviceRoleSourceColor,
} from '@/lib/deviceRoles';
import { useI18n } from '@/i18n/react';

type DeviceInfoTabProps = {
  deviceId: string;
};

type CustomFieldDef = {
  id: string;
  name: string;
  fieldKey: string;
  type: 'text' | 'number' | 'boolean' | 'dropdown' | 'date';
  options: { choices?: Array<{ label: string; value: string }>; min?: number; max?: number; maxLength?: number; pattern?: string } | null;
  required: boolean;
  defaultValue: unknown;
  deviceTypes: string[] | null;
};

type DeviceInfo = {
  hostname?: string | null;
  displayName?: string | null;
  osType?: string | null;
  osVersion?: string | null;
  osBuild?: string | null;
  architecture?: string | null;
  agentVersion?: string | null;
  status?: string | null;
  lastSeenAt?: string | null;
  enrolledAt?: string | null;
  lastUser?: string | null;
  uptimeSeconds?: number | null;
  deviceRole?: string | null;
  deviceRoleSource?: string | null;
  tags?: string[];
  customFields?: Record<string, unknown>;
  tccPermissions?: TCCPermissions | null;
  desktopAccess?: DesktopAccessState | null;
  hardware?: {
    serialNumber?: string | null;
    manufacturer?: string | null;
    model?: string | null;
    biosVersion?: string | null;
    gpuModel?: string | null;
    cpuModel?: string | null;
    cpuCores?: number | null;
    cpuThreads?: number | null;
    ramTotalMb?: number | null;
    diskTotalGb?: number | null;
  } | null;
};

function formatRam(valueMb: number | null | undefined): string {
  if (valueMb === null || valueMb === undefined) return '—';
  const gb = valueMb / 1024;
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${valueMb} MB`;
}

function formatDisk(valueGb: number | null | undefined): string {
  if (valueGb === null || valueGb === undefined) return '—';
  if (valueGb >= 1024) return `${(valueGb / 1024).toFixed(1)} TB`;
  return `${valueGb.toFixed(1)} GB`;
}

type TFunction = ReturnType<typeof useI18n>['t'];

function formatDate(dateString: string | null | undefined, locale: 'en' | 'ru'): string {
  if (!dateString) return '—';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  return date.toLocaleString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const osTypeFallbacks: Record<string, string> = {
  windows: 'Windows',
  macos: 'macOS',
  linux: 'Linux',
};

function formatOsType(raw: string | null | undefined, t: TFunction): string {
  if (!raw) return '—';
  const normalized = raw.toLowerCase();
  return t(`devices.osNames.${normalized}`, undefined, osTypeFallbacks[normalized] ?? raw);
}

function formatOsVersionForDisplay(raw: string | null | undefined): string {
  if (!raw) return '—';
  // Strip kernel name prefix (e.g. "darwin 26.3.1" → "26.3.1")
  return raw.replace(/^(darwin|linux)\s+/i, '');
}

function formatDesktopAccessMode(mode: DesktopAccessState['mode'] | undefined, t: TFunction): string {
  switch (mode) {
    case 'user_session':
      return t('deviceInfo.desktopAccess.modes.userSession');
    case 'login_window':
      return t('deviceInfo.desktopAccess.modes.loginWindow');
    case 'unavailable':
      return t('deviceInfo.values.unavailable');
    default:
      return t('deviceInfo.values.unknown');
  }
}

function formatDesktopAccessReason(reason: DesktopAccessState['reason'] | undefined | null, t: TFunction): string {
  switch (reason) {
    case 'missing_permission':
      return t('deviceInfo.desktopAccess.reasons.missingPermission');
    case 'missing_entitlement':
      return t('deviceInfo.desktopAccess.reasons.missingEntitlement');
    case 'helper_not_connected':
      return t('deviceInfo.desktopAccess.reasons.helperNotConnected');
    case 'virtual_display_unavailable':
      return t('deviceInfo.desktopAccess.reasons.virtualDisplayUnavailable');
    case 'unsupported_os':
      return t('deviceInfo.desktopAccess.reasons.unsupportedOs');
    case 'manual_install':
      return t('deviceInfo.desktopAccess.reasons.manualInstall');
    default:
      return '—';
  }
}

function formatDeviceRoleLabel(role: string, t: TFunction): string {
  return t(`devices.roles.${role}`, undefined, getDeviceRoleLabel(role));
}

function formatDeviceRoleSourceLabel(source: string, t: TFunction): string {
  return t(`deviceInfo.roleSources.${source}`, undefined, getDeviceRoleSourceLabel(source));
}

function formatCoresThreads(
  cores: number | null | undefined,
  threads: number | null | undefined,
  t: TFunction,
): string {
  if (!cores) return '—';
  if (threads) return t('deviceInfo.values.coresThreads', { cores, threads });
  return t('deviceInfo.values.coresOnly', { cores });
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-2">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-right">{value || '—'}</dd>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <dl className="divide-y">{children}</dl>
    </div>
  );
}

const statusColors: Record<string, string> = {
  online: 'bg-success/15 text-success border-success/30',
  offline: 'bg-destructive/15 text-destructive border-destructive/30',
  maintenance: 'bg-warning/15 text-warning border-warning/30',
  updating: 'bg-info/15 text-info border-info/30',
};

export default function DeviceInfoTab({ deviceId }: DeviceInfoTabProps) {
  const { locale, t } = useI18n();
  const [info, setInfo] = useState<DeviceInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [fieldDefs, setFieldDefs] = useState<CustomFieldDef[]>([]);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>('unknown');
  const [savingRole, setSavingRole] = useState(false);
  const [editingDisplayName, setEditingDisplayName] = useState(false);
  const [displayNameDraft, setDisplayNameDraft] = useState('');
  const [savingDisplayName, setSavingDisplayName] = useState(false);

  const fetchInfo = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const response = await fetchWithAuth(`/devices/${deviceId}`);
      if (!response.ok) {
        let detail = t('deviceInfo.errors.fetchDetailsHttp', { status: response.status });
        try {
          const body = await response.json();
          if (body.error) detail = body.error;
        } catch { /* failed to parse error details, using HTTP status */ }
        throw new Error(detail);
      }
      const data = await response.json();
      setInfo(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('deviceInfo.errors.fetchDetails'));
    } finally {
      setLoading(false);
    }
  }, [deviceId, t]);

  useEffect(() => {
    fetchInfo();
  }, [fetchInfo]);

  useEffect(() => {
    fetchWithAuth('/custom-fields')
      .then(r => {
        if (!r.ok) {
          console.error(`Failed to fetch custom field definitions (HTTP ${r.status})`);
          return null;
        }
        return r.json();
      })
      .then(data => {
        if (data) setFieldDefs(data.data ?? data ?? []);
      })
      .catch(err => {
        console.error('Failed to load custom field definitions:', err);
      });
  }, []);

  const handleSaveRole = async () => {
    setSavingRole(true);
    setSaveError(null);
    try {
      await runAction({
        request: () => fetchWithAuth(`/devices/${deviceId}`, {
          method: 'PATCH',
          body: JSON.stringify({ deviceRole: selectedRole }),
        }),
        errorFallback: t('deviceInfo.errors.saveRole'),
        successMessage: t('deviceInfo.messages.roleSaved'),
      });
      setInfo(prev => prev ? { ...prev, deviceRole: selectedRole, deviceRoleSource: 'manual' } : prev);
      setEditingRole(false);
    } catch (err) {
      if (err instanceof ActionError) {
        if (err.status === 401) return;
        setSaveError(err.message);
      } else {
        console.error('Failed to save device role:', err);
        setSaveError(t('deviceInfo.errors.network'));
      }
    } finally {
      setSavingRole(false);
    }
  };

  const handleSaveDisplayName = async () => {
    setSavingDisplayName(true);
    setSaveError(null);
    // Trim; an empty draft clears the display name (PATCH with null).
    const trimmed = displayNameDraft.trim();
    const payload: { displayName: string | null } = { displayName: trimmed === '' ? null : trimmed };
    try {
      await runAction({
        request: () => fetchWithAuth(`/devices/${deviceId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        }),
        errorFallback: t('deviceInfo.errors.saveDisplayName'),
        successMessage: payload.displayName === null
          ? t('deviceInfo.messages.displayNameCleared')
          : t('deviceInfo.messages.displayNameSaved'),
      });
      setInfo(prev => prev ? { ...prev, displayName: payload.displayName } : prev);
      setEditingDisplayName(false);
    } catch (err) {
      if (err instanceof ActionError) {
        if (err.status === 401) return; // auth redirect handles UX
        // runAction already surfaced a toast; mirror the message inline for
        // the form so the user sees it next to the input.
        setSaveError(err.message);
      } else {
        console.error('Failed to save display name:', err);
        setSaveError(t('deviceInfo.errors.network'));
      }
    } finally {
      setSavingDisplayName(false);
    }
  };

  // Filter field definitions to those applicable to this device's OS type
  const applicableFields = fieldDefs.filter(def => {
    if (!def.deviceTypes || def.deviceTypes.length === 0) return true;
    return info?.osType ? def.deviceTypes.includes(info.osType) : true;
  });

  const handleSaveField = async (fieldKey: string) => {
    setSaving(true);
    setSaveError(null);
    try {
      await runAction({
        request: () => fetchWithAuth(`/devices/${deviceId}`, {
          method: 'PATCH',
          body: JSON.stringify({ customFields: { [fieldKey]: editValue } }),
        }),
        errorFallback: t('deviceInfo.errors.saveCustomField', { fieldKey }),
        successMessage: t('deviceInfo.messages.customFieldSaved'),
      });
      setInfo(prev => prev ? {
        ...prev,
        customFields: { ...(prev.customFields ?? {}), [fieldKey]: editValue }
      } : prev);
      setEditingField(null);
    } catch (err) {
      if (err instanceof ActionError) {
        if (err.status === 401) return;
        setSaveError(err.message);
      } else {
        console.error(`Failed to save custom field "${fieldKey}":`, err);
        setSaveError(t('deviceInfo.errors.network'));
      }
    } finally {
      setSaving(false);
    }
  };

  const renderFieldValue = (def: CustomFieldDef, value: unknown): string => {
    if (value === null || value === undefined || value === '') return '—';
    if (def.type === 'boolean') return value ? t('deviceInfo.values.yes') : t('deviceInfo.values.no');
    if (def.type === 'dropdown' && def.options?.choices) {
      const choice = def.options.choices.find(c => c.value === value);
      return choice?.label ?? String(value);
    }
    if (def.type === 'date' && typeof value === 'string') return formatDate(value, locale);
    return String(value);
  };

  const renderFieldEditor = (def: CustomFieldDef) => {
    const inputClass = 'h-8 w-full rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring';
    switch (def.type) {
      case 'text':
        return (
          <input
            type="text"
            value={String(editValue ?? '')}
            onChange={e => setEditValue(e.target.value)}
            maxLength={def.options?.maxLength}
            className={inputClass}
            autoFocus
          />
        );
      case 'number':
        return (
          <input
            type="number"
            value={editValue === null || editValue === undefined ? '' : String(editValue)}
            onChange={e => setEditValue(e.target.value ? Number(e.target.value) : null)}
            min={def.options?.min}
            max={def.options?.max}
            className={inputClass}
            autoFocus
          />
        );
      case 'boolean':
        return (
          <button
            type="button"
            onClick={() => setEditValue(!editValue)}
            className={`inline-flex h-8 items-center rounded-full border px-3 text-sm transition ${
              editValue ? 'border-primary bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
            }`}
          >
            {editValue ? t('deviceInfo.values.yes') : t('deviceInfo.values.no')}
          </button>
        );
      case 'dropdown':
        return (
          <select
            value={String(editValue ?? '')}
            onChange={e => setEditValue(e.target.value)}
            className={inputClass}
            autoFocus
          >
            <option value="">{t('deviceInfo.actions.select')}</option>
            {def.options?.choices?.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        );
      case 'date':
        return (
          <input
            type="date"
            value={String(editValue ?? '')}
            onChange={e => setEditValue(e.target.value)}
            className={inputClass}
            autoFocus
          />
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-lg border bg-card py-12 shadow-sm">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="mt-3 text-sm text-muted-foreground">{t('deviceInfo.loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <button
          type="button"
          onClick={fetchInfo}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          {t('deviceInfo.actions.retry')}
        </button>
      </div>
    );
  }

  const hw = info?.hardware;
  const status = info?.status ?? 'offline';
  const tags = info?.tags ?? [];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Page-level save error. Hoisted out of the Custom Fields section
          (which only renders when applicableFields.length > 0) so the
          display-name / role / field error states are always visible. */}
      {saveError && (
        <div
          role="alert"
          className="lg:col-span-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {saveError}
        </div>
      )}
      <Section title={t('deviceInfo.sections.system')} icon={<Monitor className="h-4 w-4 text-muted-foreground" />}>
        <InfoRow label={t('deviceInfo.fields.hostname')} value={info?.hostname ?? '—'} />
        <div className="flex items-center justify-between py-2">
          <dt className="text-sm text-muted-foreground">{t('deviceInfo.fields.displayName')}</dt>
          <dd className="text-sm font-medium text-right flex items-center gap-2">
            {editingDisplayName ? (
              <>
                <input
                  type="text"
                  value={displayNameDraft}
                  onChange={e => setDisplayNameDraft(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') void handleSaveDisplayName();
                    if (e.key === 'Escape') setEditingDisplayName(false);
                  }}
                  maxLength={255}
                  placeholder={t('deviceInfo.placeholders.displayName')}
                  className="h-8 w-48 rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleSaveDisplayName}
                  disabled={savingDisplayName}
                  className="inline-flex h-7 w-7 items-center justify-center rounded text-primary hover:bg-primary/10"
                  title={t('deviceInfo.actions.save')}
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setEditingDisplayName(false)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted"
                  title={t('common.cancel')}
                >
                  <X className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <span className={info?.displayName ? '' : 'text-muted-foreground italic'}>
                  {info?.displayName ?? t('deviceInfo.values.notSet')}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setDisplayNameDraft(info?.displayName ?? '');
                    setEditingDisplayName(true);
                    setSaveError(null);
                  }}
                  className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                  title={t('deviceInfo.actions.editDisplayName')}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </dd>
        </div>
        <InfoRow label={t('deviceInfo.fields.serialNumber')} value={hw?.serialNumber ?? '—'} />
        <InfoRow label={t('deviceInfo.fields.manufacturer')} value={hw?.manufacturer ?? '—'} />
        <InfoRow label={t('deviceInfo.fields.model')} value={hw?.model ?? '—'} />
      </Section>

      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          {(() => {
            const role = (info?.deviceRole ?? 'unknown') as string;
            const RoleIcon = getDeviceRoleIcon(role);
            return <RoleIcon className="h-4 w-4 text-muted-foreground" />;
          })()}
          <h3 className="text-sm font-semibold">{t('deviceInfo.sections.deviceRole')}</h3>
        </div>
        <dl className="divide-y">
          <div className="flex items-center justify-between py-2">
            <dt className="text-sm text-muted-foreground">{t('deviceInfo.fields.role')}</dt>
            <dd className="text-sm font-medium text-right flex items-center gap-2">
              {editingRole ? (
                <>
                  <select
                    value={selectedRole}
                    onChange={e => setSelectedRole(e.target.value)}
                    className="h-8 w-40 rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    autoFocus
                  >
                    {DEVICE_ROLES.map(role => (
                      <option key={role} value={role}>
                        {formatDeviceRoleLabel(role, t)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleSaveRole}
                    disabled={savingRole}
                    className="inline-flex h-7 w-7 items-center justify-center rounded text-primary hover:bg-primary/10"
                    title={t('deviceInfo.actions.save')}
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingRole(false)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted"
                    title={t('common.cancel')}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <>
                  {(() => {
                    const role = (info?.deviceRole ?? 'unknown') as string;
                    const RoleIcon = getDeviceRoleIcon(role);
                    return (
                      <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted/50 px-2.5 py-1 text-xs font-medium">
                        <RoleIcon className="h-3 w-3" />
                        {formatDeviceRoleLabel(role, t)}
                      </span>
                    );
                  })()}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRole(info?.deviceRole ?? 'unknown');
                      setEditingRole(true);
                      setSaveError(null);
                    }}
                    className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                    title={t('deviceInfo.actions.changeRole')}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </dd>
          </div>
          <div className="flex justify-between py-2">
            <dt className="text-sm text-muted-foreground">{t('deviceInfo.fields.source')}</dt>
            <dd>
              <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${getDeviceRoleSourceColor(info?.deviceRoleSource ?? 'auto')}`}>
                {formatDeviceRoleSourceLabel(info?.deviceRoleSource ?? 'auto', t)}
              </span>
            </dd>
          </div>
        </dl>
      </div>

      <Section title={t('deviceInfo.sections.operatingSystem')} icon={<Info className="h-4 w-4 text-muted-foreground" />}>
        <InfoRow label={t('deviceInfo.fields.osType')} value={formatOsType(info?.osType, t)} />
        <InfoRow label={t('deviceInfo.fields.osVersion')} value={formatOsVersionForDisplay(info?.osVersion)} />
        <InfoRow label={t('deviceInfo.fields.osBuild')} value={info?.osBuild ?? '—'} />
        <InfoRow label={t('deviceInfo.fields.architecture')} value={info?.architecture ?? '—'} />
      </Section>

      <Section title={t('deviceInfo.sections.hardwareSummary')} icon={<Cpu className="h-4 w-4 text-muted-foreground" />}>
        <InfoRow label={t('deviceInfo.fields.cpuModel')} value={hw?.cpuModel ?? '—'} />
        <InfoRow label={t('deviceInfo.fields.coresThreads')} value={formatCoresThreads(hw?.cpuCores, hw?.cpuThreads, t)} />
        <InfoRow label={t('deviceInfo.fields.ramTotal')} value={formatRam(hw?.ramTotalMb)} />
        <InfoRow label={t('deviceInfo.fields.diskTotal')} value={formatDisk(hw?.diskTotalGb)} />
        <InfoRow label={t('deviceInfo.fields.gpu')} value={hw?.gpuModel ?? '—'} />
        <InfoRow label={t('deviceInfo.fields.biosVersion')} value={hw?.biosVersion ?? '—'} />
      </Section>

      <Section title={t('deviceInfo.sections.agent')} icon={<Shield className="h-4 w-4 text-muted-foreground" />}>
        <InfoRow label={t('deviceInfo.fields.agentVersion')} value={info?.agentVersion ?? '—'} />
        <div className="flex justify-between py-2">
          <dt className="text-sm text-muted-foreground">{t('deviceInfo.fields.status')}</dt>
          <dd>
            <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${statusColors[status] ?? 'bg-muted/40 text-muted-foreground border-muted'}`}>
              {t(`devices.status.${status}`, undefined, status.charAt(0).toUpperCase() + status.slice(1))}
            </span>
          </dd>
        </div>
        <InfoRow label={t('deviceInfo.fields.lastSeen')} value={formatDate(info?.lastSeenAt, locale)} />
        <InfoRow label={t('deviceInfo.fields.enrolled')} value={formatDate(info?.enrolledAt, locale)} />
        <InfoRow label={t('deviceInfo.fields.systemUptime')} value={formatUptime(info?.uptimeSeconds)} />
        <InfoRow label={t('deviceInfo.fields.loggedInUser')} value={info?.lastUser ?? '—'} />
      </Section>

      {info?.osType === 'macos' && info?.desktopAccess && (
        <Section title={t('deviceInfo.sections.desktopAccess')} icon={<Monitor className="h-4 w-4 text-muted-foreground" />}>
          <InfoRow label={t('deviceInfo.fields.mode')} value={formatDesktopAccessMode(info.desktopAccess.mode, t)} />
          <InfoRow label={t('deviceInfo.fields.loginUiReachable')} value={info.desktopAccess.loginUiReachable ? t('deviceInfo.values.yes') : t('deviceInfo.values.no')} />
          <InfoRow label={t('deviceInfo.fields.virtualDisplay')} value={info.desktopAccess.virtualDisplayReady ? t('deviceInfo.values.ready') : t('deviceInfo.values.notReady')} />
          <InfoRow
            label={t('deviceInfo.fields.remoteDesktopPermission')}
            value={
              info.desktopAccess.remoteDesktopPermission == null
                ? t('deviceInfo.values.unknown')
                : info.desktopAccess.remoteDesktopPermission ? t('deviceInfo.values.granted') : t('deviceInfo.values.missing')
            }
          />
          <InfoRow label={t('deviceInfo.fields.reason')} value={formatDesktopAccessReason(info.desktopAccess.reason, t)} />
          <InfoRow label={t('deviceInfo.fields.lastChecked')} value={formatDate(info.desktopAccess.checkedAt, locale)} />
          {info.desktopAccess.mode === 'unavailable' && (
            <div className="pt-3">
              <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  {info.desktopAccess.reason === 'unsupported_os'
                    ? t('deviceInfo.desktopAccess.warnings.unsupportedOs')
                    : info.desktopAccess.reason === 'manual_install'
                      ? t('deviceInfo.desktopAccess.warnings.manualInstall')
                      : info.desktopAccess.reason === 'missing_entitlement'
                        ? t('deviceInfo.desktopAccess.warnings.missingEntitlement')
                        : t('deviceInfo.desktopAccess.warnings.notReady')}
                </p>
              </div>
            </div>
          )}
        </Section>
      )}

      {info?.osType === 'macos' && info?.tccPermissions && (
        <MacOSPermissionsCard deviceId={deviceId} tccPermissions={info.tccPermissions} formatDate={value => formatDate(value, locale)} />
      )}

      {tags.length > 0 && (
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Tag className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">{t('deviceInfo.sections.tags')}</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-full border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

      {applicableFields.length > 0 && (
        <div className="rounded-lg border bg-card p-6 shadow-sm lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <ListChecks className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">{t('deviceInfo.sections.customFields')}</h3>
          </div>
          <dl className="divide-y">
            {applicableFields.map(def => {
              const currentValue = info?.customFields?.[def.fieldKey] ?? def.defaultValue ?? null;
              const isEditing = editingField === def.fieldKey;

              return (
                <div key={def.fieldKey} className="flex items-center justify-between gap-4 py-2">
                  <dt className="text-sm text-muted-foreground shrink-0">
                    {def.name}
                    {def.required && <span className="ml-1 text-amber-500">*</span>}
                  </dt>
                  <dd className="text-sm font-medium text-right flex items-center gap-2">
                    {isEditing ? (
                      <>
                        <div className="w-48">{renderFieldEditor(def)}</div>
                        <button
                          type="button"
                          onClick={() => handleSaveField(def.fieldKey)}
                          disabled={saving}
                          className="inline-flex h-7 w-7 items-center justify-center rounded text-primary hover:bg-primary/10"
                          title={t('deviceInfo.actions.save')}
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingField(null)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted"
                          title={t('common.cancel')}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <span>{renderFieldValue(def, currentValue)}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingField(def.fieldKey);
                            setEditValue(currentValue);
                            setSaveError(null);
                          }}
                          className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                          title={t('deviceInfo.actions.edit')}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
      )}
    </div>
  );
}
