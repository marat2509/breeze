import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Download,
  History,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchWithAuth } from '../../stores/auth';
import { navigateTo } from '@/lib/navigation';
import { formatDate as formatLocalizedDate, formatNumber, formatRelativeTime as formatLocalizedRelativeTime } from '@/i18n/formatters';
import type { Locale } from '@/i18n/locales';
import { useI18n } from '@/i18n/react';
import type { TranslationParams } from '@/i18n/resources';

type PatchResult = {
  id?: string;
  installId?: string;
  name?: string;
  title?: string;
  kb?: string;
  status?: string;
  rebootRequired?: boolean;
  errorMessage?: string;
};

type HistoryResult = {
  installedCount?: number;
  failedCount?: number;
  scannedCount?: number;
  pendingCount?: number;
  rebootRequired?: boolean;
  results?: PatchResult[];
  errorMessage?: string;
};

type PatchHistoryEntry = {
  id: string;
  type: string;
  status: string;
  createdAt: string;
  completedAt?: string;
  result?: HistoryResult;
  createdBy?: string;
  createdByEmail?: string;
};

type PatchInstallHistoryProps = {
  deviceId: string;
};

const PAGE_SIZE = 15;
const POLL_INTERVAL_MS = 30000;

type Translate = (key: string, params?: TranslationParams, fallback?: string) => string;

type TypeConfig = { label: string; icon: typeof Download };
type StatusConfig = { label: string; color: string; icon: typeof CheckCircle };

const typeConfig: Record<string, { labelKey: string; icon: typeof Download }> = {
  install_patches: { labelKey: 'patchInstallHistory.types.install', icon: Download },
  install: { labelKey: 'patchInstallHistory.types.install', icon: Download },
  patch_scan: { labelKey: 'patchInstallHistory.types.scan', icon: Search },
  scan_patches: { labelKey: 'patchInstallHistory.types.scan', icon: Search },
  scan: { labelKey: 'patchInstallHistory.types.scan', icon: Search },
  rollback_patches: { labelKey: 'patchInstallHistory.types.rollback', icon: RotateCcw },
  rollback: { labelKey: 'patchInstallHistory.types.rollback', icon: RotateCcw },
  download_patches: { labelKey: 'patchInstallHistory.types.download', icon: Download },
};

const statusConfig: Record<string, { labelKey: string; color: string; icon: typeof CheckCircle }> = {
  completed: {
    labelKey: 'patchInstallHistory.status.completed',
    color: 'bg-success/15 text-success border-success/30',
    icon: CheckCircle,
  },
  failed: {
    labelKey: 'patchInstallHistory.status.failed',
    color: 'bg-destructive/15 text-destructive border-destructive/30',
    icon: XCircle,
  },
  pending: {
    labelKey: 'patchInstallHistory.status.pending',
    color: 'bg-warning/15 text-warning border-warning/30',
    icon: Clock,
  },
  running: {
    labelKey: 'patchInstallHistory.status.running',
    color: 'bg-blue-500/20 text-blue-700 border-blue-500/40',
    icon: Loader2,
  },
  timeout: {
    labelKey: 'patchInstallHistory.status.timeout',
    color: 'bg-warning/15 text-warning border-warning/30',
    icon: AlertTriangle,
  },
};

function getTypeConfig(type: string, t: Translate): TypeConfig {
  const normalized = type.toLowerCase();
  const config = typeConfig[normalized];
  return config ? { label: t(config.labelKey), icon: config.icon } : { label: type, icon: Download };
}

function getStatusConfig(status: string, t: Translate): StatusConfig {
  const normalized = status.toLowerCase();
  const config = statusConfig[normalized] ?? statusConfig.pending;
  return { label: t(config.labelKey), color: config.color, icon: config.icon };
}

function formatDuration(createdAt: string | undefined, completedAt: string | undefined, t: Translate): string {
  if (!createdAt || !completedAt) return '--';
  const start = new Date(createdAt).getTime();
  const end = new Date(completedAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return '--';
  const totalSeconds = Math.max(0, Math.round((end - start) / 1000));
  if (totalSeconds < 1) return t('patchInstallHistory.duration.lessThanSecond');
  if (totalSeconds < 60) return t('patchInstallHistory.duration.seconds', { seconds: totalSeconds });
  const minutes = Math.floor(totalSeconds / 60);
  const remaining = totalSeconds % 60;
  return t('patchInstallHistory.duration.minutesSeconds', { minutes, seconds: remaining });
}

function formatHistoryRelativeTime(dateString: string | undefined, locale: Locale): string {
  if (!dateString) return '--';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  return formatLocalizedRelativeTime(date, locale);
}

function formatAbsoluteDate(dateString: string | undefined, locale: Locale): string {
  if (!dateString) return '--';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  return formatLocalizedDate(date, locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getPatchCount(entry: PatchHistoryEntry, locale: Locale): string {
  const result = entry.result;
  if (!result) return '--';

  const installed = result.installedCount ?? 0;
  const failed = result.failedCount ?? 0;
  const total = installed + failed;

  if (result.results && result.results.length > 0) {
    return formatNumber(result.results.length, locale);
  }

  if (total > 0) return formatNumber(total, locale);
  if (result.scannedCount != null) return formatNumber(result.scannedCount, locale);
  if (result.pendingCount != null) return formatNumber(result.pendingCount, locale);

  return '--';
}

function getPatchResultName(patch: PatchResult, t: Translate): string {
  if (patch.name || patch.title) return patch.name || patch.title || '';
  if (patch.kb) return patch.kb.toUpperCase().startsWith('KB') ? patch.kb : `KB${patch.kb}`;
  if (patch.installId) return patch.installId;
  return t('patchInstallHistory.placeholders.unknownPatch');
}

function getPatchResultKb(patch: PatchResult): string | null {
  const kb = (patch.kb || '').trim();
  if (!kb) {
    const name = patch.name || patch.title || '';
    const match = name.match(/kb\d{4,8}/i);
    return match ? match[0].toUpperCase() : null;
  }
  return kb.toUpperCase().startsWith('KB') ? kb.toUpperCase() : `KB${kb}`;
}

export default function PatchInstallHistory({ deviceId }: PatchInstallHistoryProps) {
  const { locale, t } = useI18n();
  const [history, setHistory] = useState<PatchHistoryEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string>();
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const hasInProgress = useMemo(
    () => history.some(h => h.status === 'pending' || h.status === 'running'),
    [history]
  );

  const fetchHistory = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError(undefined);
      try {
        const offset = (currentPage - 1) * PAGE_SIZE;
        const params = new URLSearchParams({
          limit: String(PAGE_SIZE),
          offset: String(offset),
        });
        if (typeFilter !== 'all') params.set('type', typeFilter);
        if (statusFilter !== 'all') params.set('status', statusFilter);

        const response = await fetchWithAuth(
          `/devices/${deviceId}/patches/history?${params.toString()}`
        );
        if (!response.ok) {
          if (response.status === 401) {
            void navigateTo('/login', { replace: true });
            return;
          }
          throw new Error(t('patchInstallHistory.errors.fetch'));
        }
        const json = await response.json();
        const data = json?.data ?? json;
        const entries: PatchHistoryEntry[] = Array.isArray(data?.history ?? data)
          ? (data?.history ?? data)
          : [];
        setHistory(entries);
        setTotal(typeof data?.total === 'number' ? data.total : entries.length);
      } catch (err) {
        if (!silent) setError(err instanceof Error ? err.message : t('patchInstallHistory.errors.fetch'));
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [deviceId, currentPage, typeFilter, statusFilter, t]
  );

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Auto-refresh polling when in-progress operations exist
  useEffect(() => {
    if (!hasInProgress) return;
    const interval = setInterval(() => fetchHistory(true), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [hasInProgress, fetchHistory]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-lg border bg-card py-12 shadow-sm">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="mt-3 text-sm text-muted-foreground">{t('patchInstallHistory.loading')}</p>
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
          onClick={() => {
            void fetchHistory();
          }}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          {t('patchInstallHistory.actions.retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <div>
            <h3 className="text-lg font-semibold">{t('patchInstallHistory.title')}</h3>
            <p className="text-sm text-muted-foreground">
              {t(total === 1 ? 'patchInstallHistory.operationCountOne' : 'patchInstallHistory.operationCountMany', {
                count: formatNumber(total, locale),
              })}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center flex-wrap">
          <select
            value={typeFilter}
            onChange={e => {
              setTypeFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring sm:w-36"
          >
            <option value="all">{t('patchInstallHistory.filters.allTypes')}</option>
            <option value="install">{t('patchInstallHistory.types.install')}</option>
            <option value="scan">{t('patchInstallHistory.types.scan')}</option>
            <option value="rollback">{t('patchInstallHistory.types.rollback')}</option>
          </select>
          <select
            value={statusFilter}
            onChange={e => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring sm:w-36"
          >
            <option value="all">{t('patchInstallHistory.filters.allStatus')}</option>
            <option value="completed">{t('patchInstallHistory.status.completed')}</option>
            <option value="failed">{t('patchInstallHistory.status.failed')}</option>
            <option value="pending">{t('patchInstallHistory.status.pending')}</option>
            <option value="timeout">{t('patchInstallHistory.status.timeout')}</option>
          </select>
          <button
            type="button"
            disabled={refreshing}
            onClick={async () => {
              setRefreshing(true);
              await fetchHistory(true);
              setRefreshing(false);
            }}
            className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? t('patchInstallHistory.actions.refreshing') : t('patchInstallHistory.actions.refresh')}
          </button>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-md border">
        <table className="min-w-full divide-y">
          <thead className="bg-muted/40">
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3">{t('patchInstallHistory.columns.operation')}</th>
              <th className="px-4 py-3">{t('patchInstallHistory.columns.status')}</th>
              <th className="px-4 py-3">{t('patchInstallHistory.columns.patches')}</th>
              <th className="px-4 py-3">{t('patchInstallHistory.columns.duration')}</th>
              <th className="px-4 py-3">{t('patchInstallHistory.columns.date')}</th>
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {history.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <History className="h-8 w-8 text-muted-foreground/50" />
                    <p>{t('patchInstallHistory.empty')}</p>
                    {(typeFilter !== 'all' || statusFilter !== 'all') && (
                      <button
                        type="button"
                        onClick={() => {
                          setTypeFilter('all');
                          setStatusFilter('all');
                          setCurrentPage(1);
                        }}
                        className="text-primary hover:underline"
                      >
                        {t('patchInstallHistory.actions.clearFilters')}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              history.map(entry => {
                const typeConf = getTypeConfig(entry.type, t);
                const TypeIcon = typeConf.icon;
                const statusConf = getStatusConfig(entry.status, t);
                const StatusIcon = statusConf.icon;
                const isExpanded = expandedId === entry.id;

                return (
                  <HistoryRow
                    key={entry.id}
                    entry={entry}
                    typeConf={typeConf}
                    TypeIcon={TypeIcon}
                    statusConf={statusConf}
                    StatusIcon={StatusIcon}
                    isExpanded={isExpanded}
                    onToggle={() => setExpandedId(isExpanded ? null : entry.id)}
                    locale={locale}
                    t={t}
                  />
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {t('patchInstallHistory.pagination.showing', {
              from: formatNumber((currentPage - 1) * PAGE_SIZE + 1, locale),
              to: formatNumber(Math.min(currentPage * PAGE_SIZE, total), locale),
              total: formatNumber(total, locale),
            })}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span>
              {t('patchInstallHistory.pagination.page', {
                page: formatNumber(currentPage, locale),
                totalPages: formatNumber(totalPages, locale),
              })}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border disabled:opacity-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function HistoryRow({
  entry,
  typeConf,
  TypeIcon,
  statusConf,
  StatusIcon,
  isExpanded,
  onToggle,
  locale,
  t,
}: {
  entry: PatchHistoryEntry;
  typeConf: TypeConfig;
  TypeIcon: typeof Download;
  statusConf: StatusConfig;
  StatusIcon: typeof CheckCircle;
  isExpanded: boolean;
  onToggle: () => void;
  locale: Locale;
  t: Translate;
}) {
  const patchCount = getPatchCount(entry, locale);
  const duration = formatDuration(entry.createdAt, entry.completedAt, t);
  const relDate = formatHistoryRelativeTime(entry.createdAt, locale);
  const absDate = formatAbsoluteDate(entry.createdAt, locale);
  const isRunning = entry.status === 'running' || entry.status === 'pending';

  return (
    <>
      <tr
        className="text-sm cursor-pointer hover:bg-muted/40 transition"
        onClick={onToggle}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <TypeIcon className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{typeConf.label}</span>
          </div>
          {entry.createdByEmail && (
            <p className="text-xs text-muted-foreground mt-0.5">{entry.createdByEmail}</p>
          )}
        </td>
        <td className="px-4 py-3">
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium',
              statusConf.color
            )}
          >
            <StatusIcon
              className={cn('h-3.5 w-3.5', isRunning && 'animate-spin')}
            />
            {statusConf.label}
          </span>
        </td>
        <td className="px-4 py-3 text-muted-foreground">{patchCount}</td>
        <td className="px-4 py-3 text-xs text-muted-foreground">
          {isRunning ? (
            <span className="flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              {t('patchInstallHistory.status.runningEllipsis')}
            </span>
          ) : (
            duration
          )}
        </td>
        <td className="px-4 py-3 text-xs text-muted-foreground" title={absDate}>
          {relDate}
        </td>
        <td className="px-4 py-3">
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </td>
      </tr>

      {isExpanded && (
        <tr>
          <td colSpan={6} className="px-0 py-0">
            <HistoryDetail entry={entry} locale={locale} t={t} />
          </td>
        </tr>
      )}
    </>
  );
}

function HistoryDetail({ entry, locale, t }: { entry: PatchHistoryEntry; locale: Locale; t: Translate }) {
  const result = entry.result;
  const type = entry.type.toLowerCase();
  const isScan = type.includes('scan');

  return (
    <div className="border-t bg-muted/10 px-6 py-4 space-y-4">
      {/* Summary stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {result?.installedCount != null && (
          <div className="rounded-md border bg-card p-3">
            <p className="text-xs font-medium text-muted-foreground">{t('patchInstallHistory.summary.installed')}</p>
            <p className="text-lg font-semibold text-green-700">{formatNumber(result.installedCount, locale)}</p>
          </div>
        )}
        {result?.failedCount != null && (
          <div className="rounded-md border bg-card p-3">
            <p className="text-xs font-medium text-muted-foreground">{t('patchInstallHistory.summary.failed')}</p>
            <p className="text-lg font-semibold text-red-700">{formatNumber(result.failedCount, locale)}</p>
          </div>
        )}
        {isScan && result?.pendingCount != null && (
          <div className="rounded-md border bg-card p-3">
            <p className="text-xs font-medium text-muted-foreground">{t('patchInstallHistory.summary.pending')}</p>
            <p className="text-lg font-semibold text-yellow-700">{formatNumber(result.pendingCount, locale)}</p>
          </div>
        )}
        {isScan && result?.scannedCount != null && (
          <div className="rounded-md border bg-card p-3">
            <p className="text-xs font-medium text-muted-foreground">{t('patchInstallHistory.summary.scanned')}</p>
            <p className="text-lg font-semibold">{formatNumber(result.scannedCount, locale)}</p>
          </div>
        )}
        {result?.rebootRequired && (
          <div className="rounded-md border border-yellow-400/50 bg-yellow-500/10 p-3">
            <p className="text-xs font-medium text-yellow-700">{t('patchInstallHistory.summary.rebootRequired')}</p>
            <p className="text-sm font-medium text-yellow-800">{t('patchInstallHistory.summary.yes')}</p>
          </div>
        )}
        <div className="rounded-md border bg-card p-3">
          <p className="text-xs font-medium text-muted-foreground">{t('patchInstallHistory.summary.started')}</p>
          <p className="text-sm font-medium">{formatAbsoluteDate(entry.createdAt, locale)}</p>
        </div>
        {entry.completedAt && (
          <div className="rounded-md border bg-card p-3">
            <p className="text-xs font-medium text-muted-foreground">{t('patchInstallHistory.summary.completed')}</p>
            <p className="text-sm font-medium">{formatAbsoluteDate(entry.completedAt, locale)}</p>
          </div>
        )}
      </div>

      {/* Error message */}
      {(entry.status === 'failed' || entry.status === 'timeout') && result?.errorMessage && (
        <div className="rounded-md border border-red-500/40 bg-red-500/5 p-4">
          <p className="text-xs font-semibold text-red-700 mb-1">{t('patchInstallHistory.columns.error')}</p>
          <p className="text-sm text-red-800 whitespace-pre-wrap">{result.errorMessage}</p>
        </div>
      )}

      {/* Individual patch results */}
      {result?.results && result.results.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-2">{t('patchInstallHistory.detail.patchResults')}</h4>
          <div className="overflow-hidden rounded-md border">
            <div className="max-h-64 overflow-y-auto">
              <table className="min-w-full divide-y">
                <thead className="bg-muted/40 sticky top-0">
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2">{t('patchInstallHistory.columns.patch')}</th>
                    <th className="px-4 py-2">KB</th>
                    <th className="px-4 py-2">{t('patchInstallHistory.columns.status')}</th>
                    <th className="px-4 py-2">{t('patchInstallHistory.columns.error')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {result.results.map((patch, index) => {
                    const patchStatus = (patch.status || 'unknown').toLowerCase();
                    const isInstalled = patchStatus === 'installed' || patchStatus === 'success' || patchStatus === 'completed';
                    const isFailed = patchStatus === 'failed' || patchStatus === 'error';
                    const kb = getPatchResultKb(patch);

                    return (
                      <tr key={patch.id ?? patch.installId ?? index} className="text-sm">
                        <td className="px-4 py-2 font-medium">{getPatchResultName(patch, t)}</td>
                        <td className="px-4 py-2 text-xs text-muted-foreground">
                          {kb ? (
                            <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-wide text-muted-foreground">
                              {kb}
                            </span>
                          ) : (
                            '--'
                          )}
                        </td>
                        <td className="px-4 py-2">
                          {isInstalled ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-success/15 border border-success/30 px-2 py-0.5 text-xs font-medium text-success">
                              <CheckCircle className="h-3 w-3" />
                              {t('patchInstallHistory.patchStatus.installed')}
                            </span>
                          ) : isFailed ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 border border-destructive/30 px-2 py-0.5 text-xs font-medium text-destructive">
                              <XCircle className="h-3 w-3" />
                              {t('patchInstallHistory.patchStatus.failed')}
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-muted/40 border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                              {patch.status || t('patchInstallHistory.status.unknown')}
                            </span>
                          )}
                          {patch.rebootRequired && (
                            <span className="ml-1.5 inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-[11px] font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200">
                              {t('patchInstallHistory.patchStatus.reboot')}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-xs text-muted-foreground max-w-xs">
                          {patch.errorMessage ? (
                            <span className="text-red-600 truncate block" title={patch.errorMessage}>
                              {patch.errorMessage}
                            </span>
                          ) : (
                            '--'
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* No detailed results */}
      {(!result?.results || result.results.length === 0) && !result?.errorMessage && (
        <p className="text-sm text-muted-foreground italic">{t('patchInstallHistory.detail.empty')}</p>
      )}
    </div>
  );
}
