import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, ArrowDown, ArrowUp, HardDrive } from 'lucide-react';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { fetchWithAuth } from '../../stores/auth';
import { formatDate, formatNumber } from '@/i18n/formatters';
import type { Locale } from '@/i18n/locales';
import { useI18n } from '@/i18n/react';
import type { TranslationParams } from '@/i18n/resources';

type TimeRange = '24h' | '7d' | '30d';
type Translate = (key: string, params?: TranslationParams) => string;

type MetricPoint = {
  timestamp: string;
  cpu: number;
  ram: number;
  disk: number;
  diskActivityAvailable: boolean;
  diskReadBps: number;
  diskWriteBps: number;
  diskReadOps: number;
  diskWriteOps: number;
  bandwidthInBps: number;
  bandwidthOutBps: number;
};

function formatBandwidth(bps: number, locale: Locale): string {
  if (bps >= 1_000_000_000) return `${formatNumber(bps / 1_000_000_000, locale, { maximumFractionDigits: 1 })} Gbps`;
  if (bps >= 1_000_000) return `${formatNumber(bps / 1_000_000, locale, { maximumFractionDigits: 1 })} Mbps`;
  if (bps >= 1_000) return `${formatNumber(bps / 1_000, locale, { maximumFractionDigits: 1 })} Kbps`;
  return `${formatNumber(Math.round(bps), locale)} bps`;
}

function formatBytesPerSec(bps: number, locale: Locale): string {
  if (bps >= 1_000_000_000) return `${formatNumber(bps / 1_000_000_000, locale, { maximumFractionDigits: 1 })} GB/s`;
  if (bps >= 1_000_000) return `${formatNumber(bps / 1_000_000, locale, { maximumFractionDigits: 1 })} MB/s`;
  if (bps >= 1_000) return `${formatNumber(bps / 1_000, locale, { maximumFractionDigits: 1 })} KB/s`;
  return `${formatNumber(Math.round(bps), locale)} B/s`;
}

type DevicePerformanceGraphsProps = {
  deviceId: string;
  compact?: boolean;
};

const timeRanges: TimeRange[] = ['24h', '7d', '30d'];

const rangeIntervals: Record<TimeRange, string> = {
  '24h': '5m',
  '7d': '1h',
  '30d': '1d'
};

function formatTimestamp(value: string, range: TimeRange, locale: Locale) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  if (range === '24h') {
    return formatDate(date, locale, { hour: '2-digit', minute: '2-digit' });
  }
  if (range === '7d') {
    return formatDate(date, locale, { weekday: 'short', hour: '2-digit' });
  }
  return formatDate(date, locale, { month: 'short', day: 'numeric' });
}

function formatTimestampFull(value: string, locale: Locale): string {
  return formatDate(value, locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatBandwidthTick(value: number, locale: Locale): string {
  if (value >= 1_000_000_000) return `${formatNumber(value / 1_000_000_000, locale, { maximumFractionDigits: 0 })}G`;
  if (value >= 1_000_000) return `${formatNumber(value / 1_000_000, locale, { maximumFractionDigits: 0 })}M`;
  if (value >= 1_000) return `${formatNumber(value / 1_000, locale, { maximumFractionDigits: 0 })}K`;
  return formatNumber(value, locale, { maximumFractionDigits: 0 });
}

function formatPercent(value: number, locale: Locale): string {
  return `${formatNumber(value, locale, { maximumFractionDigits: 0 })}%`;
}

function latestMetricLabel(metricKey: 'cpu' | 'ram' | 'disk', t: Translate): string {
  return t('devicePerformanceGraphs.latest.metric', {
    name: t(`devicePerformanceGraphs.metrics.${metricKey}`),
  });
}

export default function DevicePerformanceGraphs({ deviceId, compact = false }: DevicePerformanceGraphsProps) {
  const { locale, t } = useI18n();
  const tRef = useRef(t);
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [data, setData] = useState<MetricPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - (
        timeRange === '24h' ? 24 * 60 * 60 * 1000 :
        timeRange === '7d' ? 7 * 24 * 60 * 60 * 1000 :
        30 * 24 * 60 * 60 * 1000
      ));

      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        interval: rangeIntervals[timeRange]
      });

      const response = await fetchWithAuth(`/devices/${deviceId}/metrics?${params}`);
      if (!response.ok) throw new Error(tRef.current('devicePerformanceGraphs.errors.fetch'));
      const json = await response.json();
      const payload = json?.data ?? json;
      const normalized = Array.isArray(payload)
        ? payload.map((point: Record<string, unknown>) => ({
            timestamp: String(point.timestamp ?? point.time ?? point.ts ?? ''),
            cpu: Number(point.cpu ?? point.cpuPercent ?? 0),
            ram: Number(point.ram ?? point.ramPercent ?? 0),
            disk: Number(point.disk ?? point.diskPercent ?? 0),
            diskActivityAvailable: Boolean(point.diskActivityAvailable ?? false),
            diskReadBps: Number(point.diskReadBps ?? 0),
            diskWriteBps: Number(point.diskWriteBps ?? 0),
            diskReadOps: Number(point.diskReadOps ?? 0),
            diskWriteOps: Number(point.diskWriteOps ?? 0),
            bandwidthInBps: Number(point.bandwidthInBps ?? 0),
            bandwidthOutBps: Number(point.bandwidthOutBps ?? 0)
          }))
        : [];
      setData(normalized);
    } catch {
      setError(tRef.current('devicePerformanceGraphs.errors.fetch'));
    } finally {
      setLoading(false);
    }
  }, [deviceId, timeRange]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  const latest = useMemo(() => data[data.length - 1], [data]);
  const hasBandwidth = useMemo(() => data.some(d => d.bandwidthInBps > 0 || d.bandwidthOutBps > 0), [data]);
  const hasDiskActivity = useMemo(
    () => data.some(d => d.diskActivityAvailable || d.diskReadBps > 0 || d.diskWriteBps > 0 || d.diskReadOps > 0 || d.diskWriteOps > 0),
    [data]
  );

  const bandwidthDomain = useMemo(() => {
    if (!hasBandwidth) return [0, 1000];
    const maxVal = Math.max(
      ...data.map(d => Math.max(d.bandwidthInBps, d.bandwidthOutBps))
    );
    return [0, Math.ceil(maxVal * 1.1)];
  }, [data, hasBandwidth]);

  const diskActivityDomain = useMemo(() => {
    if (!hasDiskActivity) return [0, 1000];
    const maxVal = Math.max(
      ...data.map(d => Math.max(d.diskReadBps, d.diskWriteBps))
    );
    return [0, Math.ceil(maxVal * 1.1)];
  }, [data, hasDiskActivity]);

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-lg border bg-card py-12 shadow-sm">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="mt-3 text-sm text-muted-foreground">{t('devicePerformanceGraphs.loading')}</p>
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
          onClick={fetchMetrics}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          {t('devicePerformanceGraphs.retry')}
        </button>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border bg-card shadow-sm ${compact ? 'p-4' : 'p-6'}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <div>
            <h3 className="text-lg font-semibold">{t('devicePerformanceGraphs.title')}</h3>
            {!compact && (
              <p className="text-sm text-muted-foreground">{t('devicePerformanceGraphs.description')}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {timeRanges.map(range => (
            <button
              key={range}
              type="button"
              onClick={() => setTimeRange(range)}
              className={`rounded-md border px-3 py-1.5 text-sm font-medium transition ${
                timeRange === range
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-muted text-muted-foreground hover:border-muted-foreground hover:text-foreground'
              }`}
            >
              {t(`devicePerformanceGraphs.ranges.${range}`)}
            </button>
          ))}
        </div>
      </div>

      <div className={compact ? 'mt-4 h-56' : 'mt-6 h-80'}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="timestamp"
              tickFormatter={(value) => formatTimestamp(value, timeRange, locale)}
              tick={{ fontSize: 12 }}
              className="text-muted-foreground"
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => formatPercent(value, locale)}
              className="text-muted-foreground"
              width={45}
            />
            <Tooltip
              wrapperClassName="chart-tooltip"
              labelFormatter={(value) => formatTimestampFull(String(value), locale)}
              formatter={(value: number, name: string) => [formatPercent(value, locale), name]}
            />
            {!compact && <Legend />}
            <Line type="monotone" dataKey="cpu" stroke="#3b82f6" strokeWidth={2} dot={false} name={t('devicePerformanceGraphs.metrics.cpu')} />
            <Line type="monotone" dataKey="ram" stroke="#22c55e" strokeWidth={2} dot={false} name={t('devicePerformanceGraphs.metrics.ram')} />
            <Line type="monotone" dataKey="disk" stroke="#a855f7" strokeWidth={2} dot={false} name={t('devicePerformanceGraphs.metrics.disk')} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {!compact && latest && (
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-md border p-4">
            <div className="text-xs text-muted-foreground">{latestMetricLabel('cpu', t)}</div>
            <div className="mt-1 text-2xl font-bold">{formatPercent(latest.cpu, locale)}</div>
          </div>
          <div className="rounded-md border p-4">
            <div className="text-xs text-muted-foreground">{latestMetricLabel('ram', t)}</div>
            <div className="mt-1 text-2xl font-bold">{formatPercent(latest.ram, locale)}</div>
          </div>
          <div className="rounded-md border p-4">
            <div className="text-xs text-muted-foreground">{latestMetricLabel('disk', t)}</div>
            <div className="mt-1 text-2xl font-bold">{formatPercent(latest.disk, locale)}</div>
          </div>
        </div>
      )}

      {/* Network Bandwidth Chart */}
      {hasBandwidth && (
        <>
          <div className={compact ? 'mt-4' : 'mt-8'}>
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{t('devicePerformanceGraphs.network.title')}</h4>
          </div>
          <div className={compact ? 'mt-2 h-40' : 'mt-3 h-64'}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="bandwidthInGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="bandwidthOutGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={(value) => formatTimestamp(value, timeRange, locale)}
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={bandwidthDomain}
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => formatBandwidthTick(value, locale)}
                  className="text-muted-foreground"
                  width={50}
                />
                <Tooltip
                  wrapperClassName="chart-tooltip"
                  labelFormatter={(value) => formatTimestampFull(String(value), locale)}
                  formatter={(value: number, name: string) => [formatBandwidth(value, locale), name]}
                />
                {!compact && <Legend />}
                <Area
                  type="monotone"
                  dataKey="bandwidthInBps"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  fill="url(#bandwidthInGrad)"
                  name={t('devicePerformanceGraphs.network.download')}
                />
                <Area
                  type="monotone"
                  dataKey="bandwidthOutBps"
                  stroke="#f97316"
                  strokeWidth={2}
                  fill="url(#bandwidthOutGrad)"
                  name={t('devicePerformanceGraphs.network.upload')}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {!compact && latest && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-md border p-4">
                <div className="flex items-center gap-2">
                  <ArrowDown className="h-3.5 w-3.5 text-cyan-500" />
                  <span className="text-sm font-medium">{t('devicePerformanceGraphs.latest.metric', { name: t('devicePerformanceGraphs.network.download') })}</span>
                </div>
                <div className="mt-1 text-2xl font-bold">{formatBandwidth(latest.bandwidthInBps, locale)}</div>
              </div>
              <div className="rounded-md border p-4">
                <div className="flex items-center gap-2">
                  <ArrowUp className="h-3.5 w-3.5 text-orange-500" />
                  <span className="text-sm font-medium">{t('devicePerformanceGraphs.latest.metric', { name: t('devicePerformanceGraphs.network.upload') })}</span>
                </div>
                <div className="mt-1 text-2xl font-bold">{formatBandwidth(latest.bandwidthOutBps, locale)}</div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Disk Activity Chart */}
      {hasDiskActivity && (
        <>
          <div className={compact ? 'mt-4' : 'mt-8'}>
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{t('devicePerformanceGraphs.disk.title')}</h4>
          </div>
          <div className={compact ? 'mt-2 h-40' : 'mt-3 h-64'}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="diskReadGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16a34a" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="diskWriteGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={(value) => formatTimestamp(value, timeRange, locale)}
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={diskActivityDomain}
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => formatBandwidthTick(value, locale)}
                  className="text-muted-foreground"
                  width={50}
                />
                <Tooltip
                  wrapperClassName="chart-tooltip"
                  labelFormatter={(value) => formatTimestampFull(String(value), locale)}
                  formatter={(value: number, name: string) => [formatBytesPerSec(value, locale), name]}
                />
                {!compact && <Legend />}
                <Area
                  type="monotone"
                  dataKey="diskReadBps"
                  stroke="#16a34a"
                  strokeWidth={2}
                  fill="url(#diskReadGrad)"
                  name={t('devicePerformanceGraphs.disk.readThroughput')}
                />
                <Area
                  type="monotone"
                  dataKey="diskWriteBps"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  fill="url(#diskWriteGrad)"
                  name={t('devicePerformanceGraphs.disk.writeThroughput')}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {!compact && latest && (
            <div className="mt-4 grid gap-4 sm:grid-cols-4">
              <div className="rounded-md border p-4">
                <div className="flex items-center gap-2">
                  <HardDrive className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="text-sm font-medium">{t('devicePerformanceGraphs.disk.readThroughput')}</span>
                </div>
                <div className="mt-1 text-2xl font-bold">{formatBytesPerSec(latest.diskReadBps, locale)}</div>
              </div>
              <div className="rounded-md border p-4">
                <div className="flex items-center gap-2">
                  <HardDrive className="h-3.5 w-3.5 text-sky-600" />
                  <span className="text-sm font-medium">{t('devicePerformanceGraphs.disk.writeThroughput')}</span>
                </div>
                <div className="mt-1 text-2xl font-bold">{formatBytesPerSec(latest.diskWriteBps, locale)}</div>
              </div>
              <div className="rounded-md border p-4">
                <div className="text-xs text-muted-foreground">{t('devicePerformanceGraphs.latest.readOps')}</div>
                <div className="mt-1 text-2xl font-bold">{formatNumber(Math.round(latest.diskReadOps), locale)}</div>
              </div>
              <div className="rounded-md border p-4">
                <div className="text-xs text-muted-foreground">{t('devicePerformanceGraphs.latest.writeOps')}</div>
                <div className="mt-1 text-2xl font-bold">{formatNumber(Math.round(latest.diskWriteOps), locale)}</div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
