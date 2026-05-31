import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Timer,
  Zap,
  AlertTriangle,
  Activity,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { fetchWithAuth } from '../../stores/auth';
import { formatBytes } from '../../lib/utils';
import { formatDate, formatNumber } from '@/i18n/formatters';
import type { Locale } from '@/i18n/locales';
import { useI18n } from '@/i18n/react';
import type { TranslationParams } from '@/i18n/resources';

type StartupItem = {
  itemId: string;
  name: string;
  type: string;
  path: string;
  enabled: boolean;
  cpuTimeMs: number | null;
  diskIoBytes: number | null;
  impactScore: number | null;
};

type BootRecord = {
  id: string;
  bootTimestamp: string;
  biosSeconds: number | null;
  osLoaderSeconds: number | null;
  desktopReadySeconds: number | null;
  totalBootSeconds: number | null;
  startupItemCount: number;
  startupItems: StartupItem[];
};

type BootSummary = {
  totalBoots: number;
  avgBootTimeSeconds: number;
  fastestBootSeconds: number | null;
  slowestBootSeconds: number | null;
};

type SortField = 'name' | 'impactScore' | 'cpuTimeMs' | 'diskIoBytes';
type SortDir = 'asc' | 'desc';
type Translate = (key: string, params?: TranslationParams) => string;

type DeviceBootPerformanceTabProps = {
  deviceId: string;
  timezone?: string;
};

function formatBootTime(seconds: number | null, locale: Locale, t: Translate): string {
  if (seconds === null || seconds === undefined) return '—';
  if (seconds < 60) {
    return t('deviceBootPerformance.duration.seconds', {
      seconds: formatNumber(seconds, locale, { maximumFractionDigits: 1 }),
    });
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return t('deviceBootPerformance.duration.minutesSeconds', {
    minutes: formatNumber(mins, locale),
    seconds: formatNumber(secs, locale),
  });
}

function formatTimestampShort(value: string, locale: Locale): string {
  return formatDate(value, locale, { month: 'short', day: 'numeric' });
}

function formatTimestampFull(value: string, locale: Locale, timezone?: string): string {
  return formatDate(value, locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...(timezone ? { timeZone: timezone } : {}),
  });
}

function getImpactBadgeClass(score: number | null): string {
  if (score === null) return 'bg-muted text-muted-foreground';
  if (score > 60) return 'bg-red-500/20 text-red-700 border-red-500/30';
  if (score >= 20) return 'bg-yellow-500/20 text-yellow-800 border-yellow-500/40';
  return 'bg-emerald-500/20 text-emerald-700 border-emerald-500/40';
}

function formatStartupType(type: string, t: Translate): string {
  const knownTypes = new Set(['registry', 'folder', 'service', 'scheduled_task', 'launchd', 'systemd', 'login_item']);
  return knownTypes.has(type) ? t(`deviceBootPerformance.startupTypes.${type}`) : type;
}

function formatMs(value: number, locale: Locale, t: Translate): string {
  return t('deviceBootPerformance.duration.milliseconds', { milliseconds: formatNumber(value, locale) });
}

export default function DeviceBootPerformanceTab({ deviceId, timezone }: DeviceBootPerformanceTabProps) {
  const { locale, t } = useI18n();
  const tRef = useRef(t);
  const [boots, setBoots] = useState<BootRecord[]>([]);
  const [summary, setSummary] = useState<BootSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [collecting, setCollecting] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [sortField, setSortField] = useState<SortField>('impactScore');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [expandedBootId, setExpandedBootId] = useState<string | null>(null);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const response = await fetchWithAuth(`/devices/${deviceId}/boot-metrics?limit=30`);
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const json = await response.json();
      setBoots(json.boots ?? []);
      setSummary(json.summary ?? null);
    } catch {
      setError(tRef.current('deviceBootPerformance.errors.fetch'));
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const collectNow = async () => {
    setCollecting(true);
    setNotice(null);
    try {
      const response = await fetchWithAuth(`/devices/${deviceId}/collect-boot-metrics`, {
        method: 'POST',
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? `${response.status} ${response.statusText}`);
      }
      setNotice({ type: 'success', message: tRef.current('deviceBootPerformance.notices.collectionTriggered') });
      await fetchData();
    } catch {
      setNotice({ type: 'error', message: tRef.current('deviceBootPerformance.errors.collect') });
    } finally {
      setCollecting(false);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const sortedStartupItems = (() => {
    const items = boots[0]?.startupItems ?? [];
    return [...items].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortField === 'name') return dir * a.name.localeCompare(b.name);
      const aVal = a[sortField] ?? -1;
      const bVal = b[sortField] ?? -1;
      return dir * (aVal - bVal);
    });
  })();

  const hasPhaseData = boots.some(
    b => b.biosSeconds !== null || b.osLoaderSeconds !== null || b.desktopReadySeconds !== null
  );

  // Chart data: reverse so oldest is on the left
  const chartData = [...boots].reverse();

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-lg border bg-card py-12 shadow-sm">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="mt-3 text-sm text-muted-foreground">{t('deviceBootPerformance.loading')}</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <button
          type="button"
          onClick={fetchData}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          {t('deviceBootPerformance.retry')}
        </button>
      </div>
    );
  }

  // Empty state
  if (boots.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center rounded-lg border bg-card py-12 shadow-sm">
          <div className="text-center">
            <Timer className="mx-auto h-10 w-10 text-muted-foreground" />
            <h3 className="mt-3 text-lg font-semibold">{t('deviceBootPerformance.emptyTitle')}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('deviceBootPerformance.emptyDescription')}
            </p>
            <button
              type="button"
              onClick={collectNow}
              disabled={collecting}
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {collecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              {t('deviceBootPerformance.collectNow')}
            </button>
          </div>
        </div>
        {notice && (
          <div className={`rounded-md border p-3 text-sm ${notice.type === 'success' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700' : 'border-destructive/40 bg-destructive/10 text-destructive'}`}>
            {notice.message}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold">{t('deviceBootPerformance.title')}</h3>
            <p className="text-sm text-muted-foreground">{t('deviceBootPerformance.description')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={fetchData}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {t('deviceBootPerformance.refresh')}
            </button>
            <button
              type="button"
              onClick={collectNow}
              disabled={collecting}
              className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
            >
              {collecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              {t('deviceBootPerformance.collectNow')}
            </button>
          </div>
        </div>
      </div>

      {/* Notice banner */}
      {notice && (
        <div className={`rounded-md border p-3 text-sm ${notice.type === 'success' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700' : 'border-destructive/40 bg-destructive/10 text-destructive'}`}>
          {notice.message}
        </div>
      )}

      {/* Summary cards */}
      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Timer className="h-4 w-4" />
              {t('deviceBootPerformance.summary.avgBootTime')}
            </div>
            <p className="mt-2 text-2xl font-bold">{formatBootTime(summary.avgBootTimeSeconds, locale, t)}</p>
          </div>
          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Zap className="h-4 w-4" />
              {t('deviceBootPerformance.summary.fastestBoot')}
            </div>
            <p className="mt-2 text-2xl font-bold">{formatBootTime(summary.fastestBootSeconds, locale, t)}</p>
          </div>
          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4" />
              {t('deviceBootPerformance.summary.slowestBoot')}
            </div>
            <p className="mt-2 text-2xl font-bold">{formatBootTime(summary.slowestBootSeconds, locale, t)}</p>
          </div>
          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Activity className="h-4 w-4" />
              {t('deviceBootPerformance.summary.bootsTracked')}
            </div>
            <p className="mt-2 text-2xl font-bold">{formatNumber(summary.totalBoots, locale)}</p>
          </div>
        </div>
      )}

      {/* Boot time trend chart */}
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t('deviceBootPerformance.charts.bootTimeTrend')}
        </h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            {hasPhaseData ? (
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="biosGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="osLoaderGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="desktopGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="bootTimestamp"
                  tickFormatter={(value) => formatTimestampShort(value, locale)}
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => formatBootTime(Number(value), locale, t)}
                  className="text-muted-foreground"
                  width={50}
                />
                <Tooltip
                  wrapperClassName="chart-tooltip"
                  labelFormatter={(value) => formatTimestampFull(String(value), locale, timezone)}
                  formatter={(value: number, name: string) => [formatBootTime(value, locale, t), name]}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="biosSeconds"
                  stackId="phases"
                  stroke="#f59e0b"
                  fill="url(#biosGrad)"
                  name={t('deviceBootPerformance.phases.bios')}
                />
                <Area
                  type="monotone"
                  dataKey="osLoaderSeconds"
                  stackId="phases"
                  stroke="#3b82f6"
                  fill="url(#osLoaderGrad)"
                  name={t('deviceBootPerformance.phases.osLoader')}
                />
                <Area
                  type="monotone"
                  dataKey="desktopReadySeconds"
                  stackId="phases"
                  stroke="#22c55e"
                  fill="url(#desktopGrad)"
                  name={t('deviceBootPerformance.phases.desktopReady')}
                />
                <Line
                  type="monotone"
                  dataKey="totalBootSeconds"
                  stroke="#a855f7"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  name={t('deviceBootPerformance.phases.total')}
                />
              </AreaChart>
            ) : (
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="bootTimestamp"
                  tickFormatter={(value) => formatTimestampShort(value, locale)}
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => formatBootTime(Number(value), locale, t)}
                  className="text-muted-foreground"
                  width={50}
                />
                <Tooltip
                  wrapperClassName="chart-tooltip"
                  labelFormatter={(value) => formatTimestampFull(String(value), locale, timezone)}
                  formatter={(value: number) => [formatBootTime(value, locale, t), t('deviceBootPerformance.phases.totalBootTime')]}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="totalBootSeconds"
                  stroke="#a855f7"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name={t('deviceBootPerformance.phases.totalBootTime')}
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Startup items table (most recent boot) */}
      {boots[0]?.startupItems?.length > 0 && (
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t('deviceBootPerformance.startup.titleLatest')}
          </h3>
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-4">
                    <button type="button" onClick={() => handleSort('name')} className="inline-flex items-center gap-1 hover:text-foreground">
                      {t('deviceBootPerformance.startup.columns.name')} {sortField === 'name' && (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                    </button>
                  </th>
                  <th className="pb-2 pr-4">{t('deviceBootPerformance.startup.columns.type')}</th>
                  <th className="pb-2 pr-4">{t('deviceBootPerformance.startup.columns.status')}</th>
                  <th className="pb-2 pr-4">
                    <button type="button" onClick={() => handleSort('cpuTimeMs')} className="inline-flex items-center gap-1 hover:text-foreground">
                      {t('deviceBootPerformance.startup.columns.cpuTime')} {sortField === 'cpuTimeMs' && (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                    </button>
                  </th>
                  <th className="pb-2 pr-4">
                    <button type="button" onClick={() => handleSort('diskIoBytes')} className="inline-flex items-center gap-1 hover:text-foreground">
                      {t('deviceBootPerformance.startup.columns.diskIo')} {sortField === 'diskIoBytes' && (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                    </button>
                  </th>
                  <th className="pb-2">
                    <button type="button" onClick={() => handleSort('impactScore')} className="inline-flex items-center gap-1 hover:text-foreground">
                      {t('deviceBootPerformance.startup.columns.impact')} {sortField === 'impactScore' && (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedStartupItems.map((item) => (
                  <tr key={item.itemId} className="border-b last:border-0">
                    <td className="py-2.5 pr-4">
                      <p className="font-medium">{item.name}</p>
                      {item.path && (
                        <p className="mt-0.5 text-xs text-muted-foreground truncate max-w-xs" title={item.path}>
                          {item.path}
                        </p>
                      )}
                    </td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{formatStartupType(item.type, t)}</td>
                    <td className="py-2.5 pr-4">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${
                        item.enabled
                          ? 'bg-emerald-500/20 text-emerald-700 border-emerald-500/40'
                          : 'bg-muted text-muted-foreground border-muted'
                      }`}>
                        {item.enabled ? t('deviceBootPerformance.status.enabled') : t('deviceBootPerformance.status.disabled')}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-muted-foreground">
                      {item.cpuTimeMs !== null ? formatMs(item.cpuTimeMs, locale, t) : '—'}
                    </td>
                    <td className="py-2.5 pr-4 text-muted-foreground">
                      {item.diskIoBytes !== null ? formatBytes(item.diskIoBytes) : '—'}
                    </td>
                    <td className="py-2.5">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${getImpactBadgeClass(item.impactScore)}`}>
                        {item.impactScore !== null ? item.impactScore : '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Boot history table */}
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t('deviceBootPerformance.history.title')}
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 pr-4">{t('deviceBootPerformance.history.columns.timestamp')}</th>
                <th className="pb-2 pr-4">{t('deviceBootPerformance.history.columns.totalTime')}</th>
                <th className="pb-2 pr-4">{t('deviceBootPerformance.phases.bios')}</th>
                <th className="pb-2 pr-4">{t('deviceBootPerformance.phases.osLoader')}</th>
                <th className="pb-2 pr-4">{t('deviceBootPerformance.phases.desktopReady')}</th>
                <th className="pb-2">{t('deviceBootPerformance.history.columns.startupItems')}</th>
              </tr>
            </thead>
            <tbody>
              {boots.map((boot) => (
                <BootHistoryRow
                  key={boot.id}
                  boot={boot}
                  timezone={timezone}
                  locale={locale}
                  t={t}
                  expanded={expandedBootId === boot.id}
                  onToggle={() => setExpandedBootId(expandedBootId === boot.id ? null : boot.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function BootHistoryRow({
  boot,
  timezone,
  locale,
  t,
  expanded,
  onToggle,
}: {
  boot: BootRecord;
  timezone?: string;
  locale: Locale;
  t: Translate;
  expanded: boolean;
  onToggle: () => void;
}) {
  const topItems = [...(boot.startupItems ?? [])]
    .sort((a, b) => (b.impactScore ?? 0) - (a.impactScore ?? 0))
    .slice(0, 10);

  return (
    <>
      <tr
        className="border-b cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={onToggle}
      >
        <td className="py-2.5 pr-4">
          <div className="flex items-center gap-2">
            {boot.startupItems?.length > 0 && (
              expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            {formatTimestampFull(boot.bootTimestamp, locale, timezone)}
          </div>
        </td>
        <td className="py-2.5 pr-4 font-medium">{formatBootTime(boot.totalBootSeconds, locale, t)}</td>
        <td className="py-2.5 pr-4 text-muted-foreground">{formatBootTime(boot.biosSeconds, locale, t)}</td>
        <td className="py-2.5 pr-4 text-muted-foreground">{formatBootTime(boot.osLoaderSeconds, locale, t)}</td>
        <td className="py-2.5 pr-4 text-muted-foreground">{formatBootTime(boot.desktopReadySeconds, locale, t)}</td>
        <td className="py-2.5 text-muted-foreground">{formatNumber(boot.startupItemCount, locale)}</td>
      </tr>
      {expanded && topItems.length > 0 && (
        <tr>
          <td colSpan={6} className="bg-muted/30 px-4 py-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('deviceBootPerformance.history.topItems', { count: formatNumber(topItems.length, locale) })}
            </p>
            <div className="grid gap-1">
              {topItems.map((item) => (
                <div key={item.itemId} className="flex items-center justify-between rounded-md bg-background px-3 py-1.5 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{item.name}</span>
                    <span className="text-muted-foreground">{formatStartupType(item.type, t)}</span>
                  </div>
                  <div className="flex items-center gap-4 text-muted-foreground">
                    {item.cpuTimeMs !== null && (
                      <span>{t('deviceBootPerformance.history.cpuTime', { value: formatMs(item.cpuTimeMs, locale, t) })}</span>
                    )}
                    {item.diskIoBytes !== null && <span>{formatBytes(item.diskIoBytes)}</span>}
                    <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-xs font-semibold ${getImpactBadgeClass(item.impactScore)}`}>
                      {item.impactScore ?? '—'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
