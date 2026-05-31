import { useState, useEffect, useCallback, useRef } from 'react';
import {
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
import { navigateTo } from '@/lib/navigation';
import { formatNumber } from '@/i18n/formatters';
import type { Locale } from '@/i18n/locales';
import { useI18n } from '@/i18n/react';

type TimeRange = '1h' | '6h' | '24h' | '7d' | '30d';
type MetricKey = 'cpu' | 'ram' | 'disk';

type DeviceMetricsChartProps = {
  compact?: boolean;
  deviceId?: string;
};

type MetricDataPoint = {
  timestamp: string;
  cpu: number;
  ram: number;
  disk: number;
};

const timeRanges: TimeRange[] = ['1h', '6h', '24h', '7d', '30d'];

function formatTimestamp(timestamp: string, range: TimeRange, locale: Locale): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;

  switch (range) {
    case '1h':
    case '6h':
      return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(date);
    case '24h':
      return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(date);
    case '7d':
      return new Intl.DateTimeFormat(locale, { weekday: 'short', hour: '2-digit' }).format(date);
    case '30d':
      return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(date);
    default:
      return new Intl.DateTimeFormat(locale).format(date);
  }
}

function metricLabel(metric: MetricKey, t: (key: string) => string): string {
  return t(`deviceMetricsChart.metrics.${metric}`);
}

function formatPercent(value: number, locale: Locale): string {
  return `${formatNumber(value, locale, { maximumFractionDigits: 1 })}%`;
}

export default function DeviceMetricsChart({ compact = false, deviceId }: DeviceMetricsChartProps) {
  const { locale, t } = useI18n();
  const tRef = useRef(t);
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [visibleMetrics, setVisibleMetrics] = useState({
    cpu: true,
    ram: true,
    disk: true
  });
  const [data, setData] = useState<MetricDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const fetchMetrics = useCallback(async () => {
    if (!deviceId) {
      setError(tRef.current('deviceMetricsChart.errors.noDevice'));
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetchWithAuth(`/devices/${deviceId}/metrics?range=${timeRange}`);

      if (response.status === 401) {
        void navigateTo('/login', { replace: true });
        return;
      }

      if (!response.ok) {
        throw new Error(tRef.current('deviceMetricsChart.errors.fetch'));
      }

      const result = await response.json();
      setData(result.metrics || []);
    } catch {
      setError(tRef.current('deviceMetricsChart.errors.fetch'));
    } finally {
      setIsLoading(false);
    }
  }, [deviceId, timeRange]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  const toggleMetric = (metric: 'cpu' | 'ram' | 'disk') => {
    setVisibleMetrics(prev => ({ ...prev, [metric]: !prev[metric] }));
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <div className="flex h-48 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <div className="flex h-48 flex-col items-center justify-center gap-2 text-muted-foreground">
          <p>{error}</p>
          <button
            type="button"
            onClick={fetchMetrics}
            className="text-sm text-primary hover:underline"
          >
            {t('deviceMetricsChart.retry')}
          </button>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold">{t('deviceMetricsChart.compactTitle')}</h3>
          <select
            value={timeRange}
            onChange={e => setTimeRange(e.target.value as TimeRange)}
            className="h-8 rounded-md border bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {timeRanges.map((value) => (
              <option key={value} value={value}>{t(`deviceMetricsChart.timeRanges.${value}`)}</option>
            ))}
          </select>
        </div>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="timestamp"
                tickFormatter={(value) => formatTimestamp(value, timeRange, locale)}
                tick={{ fontSize: 10 }}
                className="text-muted-foreground"
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 10 }}
                className="text-muted-foreground"
                width={30}
              />
              <Tooltip
                wrapperClassName="chart-tooltip"
                labelFormatter={(value) => new Date(value).toLocaleString(locale)}
              />
              <Line
                type="monotone"
                dataKey="cpu"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                name={metricLabel('cpu', t)}
              />
              <Line
                type="monotone"
                dataKey="ram"
                stroke="#22c55e"
                strokeWidth={2}
                dot={false}
                name={metricLabel('ram', t)}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold">{t('deviceMetricsChart.title')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('deviceMetricsChart.description')}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => toggleMetric('cpu')}
              className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition ${
                visibleMetrics.cpu
                  ? 'border-blue-500 bg-blue-500/10 text-blue-700'
                  : 'border-muted text-muted-foreground hover:border-blue-500/50'
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              {metricLabel('cpu', t)}
            </button>
            <button
              type="button"
              onClick={() => toggleMetric('ram')}
              className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition ${
                visibleMetrics.ram
                  ? 'border-green-500 bg-green-500/10 text-green-700'
                  : 'border-muted text-muted-foreground hover:border-green-500/50'
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-green-500" />
              {metricLabel('ram', t)}
            </button>
            <button
              type="button"
              onClick={() => toggleMetric('disk')}
              className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition ${
                visibleMetrics.disk
                  ? 'border-purple-500 bg-purple-500/10 text-purple-700'
                  : 'border-muted text-muted-foreground hover:border-purple-500/50'
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-purple-500" />
              {metricLabel('disk', t)}
            </button>
          </div>
          <select
            value={timeRange}
            onChange={e => setTimeRange(e.target.value as TimeRange)}
            className="h-10 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {timeRanges.map((value) => (
              <option key={value} value={value}>{t(`deviceMetricsChart.timeRanges.${value}`)}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="h-80">
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
              className="text-muted-foreground"
              tickFormatter={(value) => `${value}%`}
              width={45}
            />
            <Tooltip
              wrapperClassName="chart-tooltip"
              labelFormatter={(value) => new Date(value).toLocaleString(locale)}
              formatter={(value: number, name: string) => [formatPercent(value, locale), name]}
            />
            <Legend />
            {visibleMetrics.cpu && (
              <Line
                type="monotone"
                dataKey="cpu"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                name={metricLabel('cpu', t)}
                activeDot={{ r: 4 }}
              />
            )}
            {visibleMetrics.ram && (
              <Line
                type="monotone"
                dataKey="ram"
                stroke="#22c55e"
                strokeWidth={2}
                dot={false}
                name={metricLabel('ram', t)}
                activeDot={{ r: 4 }}
              />
            )}
            {visibleMetrics.disk && (
              <Line
                type="monotone"
                dataKey="disk"
                stroke="#a855f7"
                strokeWidth={2}
                dot={false}
                name={metricLabel('disk', t)}
                activeDot={{ r: 4 }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-md border p-4">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-blue-500" />
            <span className="text-sm font-medium">{metricLabel('cpu', t)}</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold">{formatPercent(data[data.length - 1]?.cpu ?? 0, locale)}</span>
            <span className="text-xs text-muted-foreground">{t('deviceMetricsChart.current')}</span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {t('deviceMetricsChart.avg')}: {formatPercent(data.length > 0 ? Math.round(data.reduce((sum, d) => sum + d.cpu, 0) / data.length) : 0, locale)} |
            {t('deviceMetricsChart.max')}: {formatPercent(data.length > 0 ? Math.max(...data.map(d => d.cpu)) : 0, locale)}
          </div>
        </div>

        <div className="rounded-md border p-4">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-green-500" />
            <span className="text-sm font-medium">{metricLabel('ram', t)}</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold">{formatPercent(data[data.length - 1]?.ram ?? 0, locale)}</span>
            <span className="text-xs text-muted-foreground">{t('deviceMetricsChart.current')}</span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {t('deviceMetricsChart.avg')}: {formatPercent(data.length > 0 ? Math.round(data.reduce((sum, d) => sum + d.ram, 0) / data.length) : 0, locale)} |
            {t('deviceMetricsChart.max')}: {formatPercent(data.length > 0 ? Math.max(...data.map(d => d.ram)) : 0, locale)}
          </div>
        </div>

        <div className="rounded-md border p-4">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-purple-500" />
            <span className="text-sm font-medium">{metricLabel('disk', t)}</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold">{formatPercent(data[data.length - 1]?.disk ?? 0, locale)}</span>
            <span className="text-xs text-muted-foreground">{t('deviceMetricsChart.current')}</span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {t('deviceMetricsChart.avg')}: {formatPercent(data.length > 0 ? Math.round(data.reduce((sum, d) => sum + d.disk, 0) / data.length * 10) / 10 : 0, locale)} |
            {t('deviceMetricsChart.max')}: {formatPercent(data.length > 0 ? Math.max(...data.map(d => d.disk)) : 0, locale)}
          </div>
        </div>
      </div>
    </div>
  );
}
