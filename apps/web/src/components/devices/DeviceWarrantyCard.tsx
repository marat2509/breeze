import { useState, useEffect } from 'react';
import { ShieldCheck, RefreshCw } from 'lucide-react';
import { fetchWithAuth } from '../../stores/auth';
import { formatDate as formatLocalizedDate, formatRelativeTime } from '@/i18n/formatters';
import { useI18n } from '@/i18n/react';
import type { Locale } from '@/i18n/locales';

type WarrantyEntitlement = {
  provider: string;
  serviceLevelDescription: string;
  entitlementType: string;
  startDate: string;
  endDate: string;
};

type WarrantyData = {
  id: string;
  deviceId: string;
  manufacturer: string;
  serialNumber: string;
  status: 'active' | 'expiring' | 'expired' | 'unknown';
  warrantyStartDate: string | null;
  warrantyEndDate: string | null;
  entitlements: WarrantyEntitlement[];
  dataSource: string | null;
  lastSyncAt: string | null;
  lastSyncError: string | null;
};

type DeviceWarrantyCardProps = {
  deviceId: string;
  compact?: boolean;
};

const statusColors: Record<string, string> = {
  active: 'bg-success/15 text-success border-success/30',
  expiring: 'bg-warning/15 text-warning border-warning/30',
  expired: 'bg-destructive/15 text-destructive border-destructive/30',
  unknown: 'bg-muted text-muted-foreground border-border',
};

function formatWarrantyDate(dateStr: string | null, locale: Locale): string {
  if (!dateStr) return '\u2014';
  return formatLocalizedDate(dateStr, locale, { year: 'numeric', month: 'short', day: 'numeric' });
}

function dataSourceLabel(source: string | null, t: (key: string) => string): string {
  if (!source) return '';
  switch (source) {
    case 'agent_plist': return t('deviceWarranty.dataSources.agentPlist');
    case 'provider': return t('deviceWarranty.dataSources.provider');
    default: return source;
  }
}

function formatLastSync(dateStr: string | null, locale: Locale, t: (key: string) => string): string {
  if (!dateStr) return t('deviceWarranty.never');
  return formatRelativeTime(dateStr, locale);
}

export default function DeviceWarrantyCard({ deviceId, compact = false }: DeviceWarrantyCardProps) {
  const { locale, t } = useI18n();
  const [warranty, setWarranty] = useState<WarrantyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchWarranty = async () => {
    try {
      const res = await fetchWithAuth(`/devices/${deviceId}/warranty`);
      if (res.ok) {
        const data = await res.json();
        setWarranty(data.warranty);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWarranty();
  }, [deviceId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchWithAuth(`/devices/${deviceId}/warranty/refresh`, { method: 'POST' });
      // Re-fetch after a short delay to allow the worker to process
      setTimeout(() => {
        fetchWarranty();
        setRefreshing(false);
      }, 3000);
    } catch {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg border bg-card p-4 shadow-sm animate-pulse">
        <div className="h-4 w-24 rounded bg-muted" />
        <div className="mt-3 h-6 w-48 rounded bg-muted" />
      </div>
    );
  }

  if (!warranty) {
    if (compact) {
      return (
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4" />
            {t('deviceWarranty.compactTitle')}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{t('deviceWarranty.noInfo')}</p>
        </div>
      );
    }
    return null;
  }

  const statusKey = statusColors[warranty.status] ? warranty.status : 'unknown';
  const statusColor = statusColors[statusKey] ?? statusColors.unknown;
  const statusLabel = t(`deviceWarranty.status.${statusKey}`);
  const primaryEntitlement = warranty.entitlements?.[0];

  if (compact) {
    return (
      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4" />
            {t('deviceWarranty.compactTitle')}
          </div>
          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusColor}`}>
            {statusLabel}
          </span>
        </div>
        <p className="mt-2 text-sm font-medium">
          {primaryEntitlement
            ? `${warranty.manufacturer?.toUpperCase()} ${primaryEntitlement.serviceLevelDescription}`
            : warranty.manufacturer?.toUpperCase() ?? t('deviceWarranty.unknown')}
        </p>
        {warranty.warrantyEndDate && (
          <p className="text-xs text-muted-foreground">
            {t('deviceWarranty.expires', { date: formatWarrantyDate(warranty.warrantyEndDate, locale) })}
          </p>
        )}
      </div>
    );
  }

  // Full expanded view
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">{t('deviceWarranty.title')}</h3>
          <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${statusColor}`}>
            {statusLabel}
          </span>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? t('deviceWarranty.refreshing') : t('deviceWarranty.refresh')}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <div>
          <p className="text-xs text-muted-foreground">{t('deviceWarranty.manufacturer')}</p>
          <p className="text-sm font-medium">{warranty.manufacturer?.toUpperCase() ?? '\u2014'}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t('deviceWarranty.serialNumber')}</p>
          <p className="text-sm font-medium font-mono">{warranty.serialNumber ?? '\u2014'}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t('deviceWarranty.startDate')}</p>
          <p className="text-sm font-medium">{formatWarrantyDate(warranty.warrantyStartDate, locale)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t('deviceWarranty.endDate')}</p>
          <p className="text-sm font-medium">{formatWarrantyDate(warranty.warrantyEndDate, locale)}</p>
        </div>
      </div>

      {warranty.entitlements && warranty.entitlements.length > 0 && (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2">{t('deviceWarranty.serviceLevel')}</th>
                <th className="px-4 py-2">{t('deviceWarranty.type')}</th>
                <th className="px-4 py-2">{t('deviceWarranty.startDate')}</th>
                <th className="px-4 py-2">{t('deviceWarranty.endDate')}</th>
              </tr>
            </thead>
            <tbody>
              {warranty.entitlements.map((e, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="px-4 py-2">{e.serviceLevelDescription}</td>
                  <td className="px-4 py-2">{e.entitlementType}</td>
                  <td className="px-4 py-2">{formatWarrantyDate(e.startDate, locale)}</td>
                  <td className="px-4 py-2">{formatWarrantyDate(e.endDate, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span>{t('deviceWarranty.lastChecked', { value: formatLastSync(warranty.lastSyncAt, locale, t) })}</span>
        {warranty.dataSource && (
          <span>{t('deviceWarranty.source', { value: dataSourceLabel(warranty.dataSource, t) })}</span>
        )}
        {/* Legacy: pre-v0.13.9 syncs stored "No configured provider..." as lastSyncError.
            Post-v0.13.9, lastSyncError is null for no-provider cases. Remove after re-sync cycle. */}
        {warranty.lastSyncError && (
          warranty.lastSyncError.includes('No configured provider')
            ? <span className="text-muted-foreground">{t('deviceWarranty.lookupUnavailable')}</span>
            : <span className="text-red-500">{t('deviceWarranty.error', { message: warranty.lastSyncError })}</span>
        )}
      </div>
    </div>
  );
}
