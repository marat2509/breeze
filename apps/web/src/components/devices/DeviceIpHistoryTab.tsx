import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock3, Network, RefreshCw, Search, X } from 'lucide-react';
import { fetchWithAuth } from '../../stores/auth';
import { formatDate, formatNumber } from '@/i18n/formatters';
import type { Locale } from '@/i18n/locales';
import { useI18n } from '@/i18n/react';
import type { TranslationParams } from '@/i18n/resources';

type IPAssignmentType = 'dhcp' | 'static' | 'vpn' | 'link-local' | 'unknown';
type IPType = 'ipv4' | 'ipv6';
type Translate = (key: string, params?: TranslationParams) => string;

type DeviceIpHistoryEntry = {
  id?: string;
  interfaceName?: string;
  ipAddress?: string;
  ipType?: IPType;
  assignmentType?: IPAssignmentType;
  macAddress?: string | null;
  subnetMask?: string | null;
  gateway?: string | null;
  dnsServers?: string[] | null;
  firstSeen?: string | null;
  lastSeen?: string | null;
  isActive?: boolean;
  deactivatedAt?: string | null;
};

type DeviceIpHistoryResponse = {
  deviceId?: string;
  count?: number;
  data?: DeviceIpHistoryEntry[];
};

type DeviceIpHistoryTabProps = {
  deviceId: string;
};

const ASSIGNMENT_TYPES: Array<'all' | IPAssignmentType> = ['all', 'dhcp', 'static', 'vpn', 'link-local', 'unknown'];
const PAGE_SIZE = 25;
const MAX_FETCH_LIMIT = 500;

function formatDateTime(value: string | null | undefined, locale: Locale): string {
  if (!value) return '—';
  return formatDate(value, locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatAssignment(value: string | undefined, t: Translate): string {
  const key = ASSIGNMENT_TYPES.includes(value as IPAssignmentType) && value !== 'all' ? value : 'unknown';
  return t(`deviceIpHistory.assignmentTypes.${key}`);
}

function formatIpType(value: IPType | undefined, t: Translate): string {
  return t(`deviceIpHistory.ipTypes.${value === 'ipv6' ? 'ipv6' : 'ipv4'}`);
}

function badgeClassForAssignment(value?: string): string {
  switch (value) {
    case 'dhcp':
      return 'bg-blue-500/10 text-blue-600';
    case 'static':
      return 'bg-emerald-500/10 text-emerald-600';
    case 'vpn':
      return 'bg-violet-500/10 text-violet-600';
    case 'link-local':
      return 'bg-amber-500/10 text-amber-700';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

export default function DeviceIpHistoryTab({ deviceId }: DeviceIpHistoryTabProps) {
  const { locale, t } = useI18n();
  const tRef = useRef(t);
  const [entries, setEntries] = useState<DeviceIpHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [fetchedCount, setFetchedCount] = useState(0);

  const [search, setSearch] = useState('');
  const [assignmentFilter, setAssignmentFilter] = useState<'all' | IPAssignmentType>('all');
  const [interfaceFilter, setInterfaceFilter] = useState<string>('all');
  const [ipTypeFilter, setIpTypeFilter] = useState<'all' | IPType>('all');
  const [activeOnly, setActiveOnly] = useState(false);
  const [sinceDate, setSinceDate] = useState('');
  const [untilDate, setUntilDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const fetchIpHistory = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const params = new URLSearchParams({
        limit: String(MAX_FETCH_LIMIT),
        offset: '0',
        active_only: activeOnly ? 'true' : 'false',
      });
      const response = await fetchWithAuth(`/devices/${deviceId}/ip-history?${params.toString()}`);
      if (!response.ok) {
        if (response.status === 404) {
          setError(tRef.current('deviceIpHistory.errors.notAvailable'));
        } else if (response.status === 403) {
          setError(tRef.current('deviceIpHistory.errors.forbidden'));
        } else {
          setError(tRef.current('deviceIpHistory.errors.fetchStatus', { status: response.status }));
        }
        return;
      }
      const json = await response.json() as DeviceIpHistoryResponse;
      const payload = json.data ?? [];
      setEntries(Array.isArray(payload) ? payload : []);
      setFetchedCount(typeof json.count === 'number' ? json.count : Array.isArray(payload) ? payload.length : 0);
    } catch {
      setError(tRef.current('deviceIpHistory.errors.fetch'));
    } finally {
      setLoading(false);
    }
  }, [activeOnly, deviceId]);

  useEffect(() => {
    fetchIpHistory();
  }, [fetchIpHistory]);

  const interfaceNames = useMemo(() => {
    const names = new Set<string>();
    for (const row of entries) {
      const value = row.interfaceName?.trim();
      if (value) names.add(value);
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [entries]);

  const filteredRows = useMemo(() => {
    const searchLower = search.trim().toLowerCase();
    const since = sinceDate ? new Date(`${sinceDate}T00:00:00`) : null;
    const until = untilDate ? new Date(`${untilDate}T23:59:59`) : null;

    return entries.filter((row) => {
      const interfaceName = row.interfaceName ?? '';
      const ipAddress = row.ipAddress ?? '';
      const ipType = row.ipType ?? 'ipv4';
      const assignment = row.assignmentType ?? 'unknown';

      if (assignmentFilter !== 'all' && assignment !== assignmentFilter) return false;
      if (interfaceFilter !== 'all' && interfaceName !== interfaceFilter) return false;
      if (ipTypeFilter !== 'all' && ipType !== ipTypeFilter) return false;

      if (since) {
        const rowLastSeen = row.lastSeen ? new Date(row.lastSeen) : null;
        if (!rowLastSeen || rowLastSeen < since) return false;
      }

      if (until) {
        const rowFirstSeen = row.firstSeen ? new Date(row.firstSeen) : null;
        if (!rowFirstSeen || rowFirstSeen > until) return false;
      }

      if (searchLower) {
        const haystack = [
          interfaceName,
          ipAddress,
          ipType,
          assignment,
          row.macAddress ?? '',
          row.gateway ?? '',
          row.subnetMask ?? '',
          ...(row.dnsServers ?? []),
        ].join(' ').toLowerCase();
        if (!haystack.includes(searchLower)) return false;
      }

      return true;
    });
  }, [entries, assignmentFilter, interfaceFilter, ipTypeFilter, sinceDate, untilDate, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const paginatedRows = filteredRows.slice(startIndex, startIndex + PAGE_SIZE);

  useEffect(() => {
    setCurrentPage(1);
  }, [assignmentFilter, interfaceFilter, ipTypeFilter, sinceDate, untilDate, search, activeOnly]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const clearFilters = () => {
    setSearch('');
    setAssignmentFilter('all');
    setInterfaceFilter('all');
    setIpTypeFilter('all');
    setSinceDate('');
    setUntilDate('');
    setCurrentPage(1);
  };

  const hasFilters = Boolean(
    search ||
    assignmentFilter !== 'all' ||
    interfaceFilter !== 'all' ||
    ipTypeFilter !== 'all' ||
    sinceDate ||
    untilDate
  );

  const countLabel = filteredRows.length === fetchedCount
    ? formatNumber(fetchedCount, locale)
    : t('deviceIpHistory.filteredCount', {
      filtered: formatNumber(filteredRows.length, locale),
      total: formatNumber(fetchedCount, locale),
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-lg border bg-card py-12 shadow-sm">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="mt-3 text-sm text-muted-foreground">{t('deviceIpHistory.loading')}</p>
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
          onClick={fetchIpHistory}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          {t('deviceIpHistory.retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Network className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold">{t('deviceIpHistory.title')}</h3>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {countLabel}
          </span>
        </div>
        <button
          type="button"
          onClick={fetchIpHistory}
          className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {t('deviceIpHistory.refresh')}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder={t('deviceIpHistory.searchPlaceholder')}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-md border bg-background py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <select
          value={assignmentFilter}
          onChange={(event) => setAssignmentFilter(event.target.value as 'all' | IPAssignmentType)}
          className="rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          {ASSIGNMENT_TYPES.map((value) => (
            <option key={value} value={value}>
              {value === 'all' ? t('deviceIpHistory.allAssignments') : formatAssignment(value, t)}
            </option>
          ))}
        </select>

        <select
          value={interfaceFilter}
          onChange={(event) => setInterfaceFilter(event.target.value)}
          className="rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="all">{t('deviceIpHistory.allInterfaces')}</option>
          {interfaceNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        <select
          value={ipTypeFilter}
          onChange={(event) => setIpTypeFilter(event.target.value as 'all' | IPType)}
          className="rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="all">{t('deviceIpHistory.allIpTypes')}</option>
          <option value="ipv4">{formatIpType('ipv4', t)}</option>
          <option value="ipv6">{formatIpType('ipv6', t)}</option>
        </select>

        <label className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            className="h-4 w-4 accent-primary"
            checked={activeOnly}
            onChange={(event) => setActiveOnly(event.target.checked)}
          />
          {t('deviceIpHistory.activeOnly')}
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Clock3 className="h-4 w-4" />
          {t('deviceIpHistory.since')}
          <input
            type="date"
            value={sinceDate}
            onChange={(event) => setSinceDate(event.target.value)}
            className="rounded-md border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          {t('deviceIpHistory.until')}
          <input
            type="date"
            value={untilDate}
            onChange={(event) => setUntilDate(event.target.value)}
            className="rounded-md border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </label>
        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center gap-1.5 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
            {t('deviceIpHistory.clearFilters')}
          </button>
        )}
      </div>

      <div className="mt-4 overflow-hidden rounded-md border">
        <div className="max-h-[560px] overflow-auto">
          <table className="min-w-full divide-y">
            <thead className="sticky top-0 bg-muted/40">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">{t('deviceIpHistory.columns.interface')}</th>
                <th className="px-4 py-3">{t('deviceIpHistory.columns.ipAddress')}</th>
                <th className="px-4 py-3">{t('deviceIpHistory.columns.type')}</th>
                <th className="px-4 py-3">{t('deviceIpHistory.columns.assignment')}</th>
                <th className="px-4 py-3">{t('deviceIpHistory.columns.firstSeen')}</th>
                <th className="px-4 py-3">{t('deviceIpHistory.columns.lastSeen')}</th>
                <th className="px-4 py-3">{t('deviceIpHistory.columns.status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-sm text-muted-foreground">
                    {hasFilters ? t('deviceIpHistory.emptyFiltered') : t('deviceIpHistory.empty')}
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row, index) => (
                  <tr key={row.id ?? `${row.interfaceName ?? 'iface'}-${row.ipAddress ?? 'ip'}-${index}`} className="text-sm hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{row.interfaceName ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{row.ipAddress ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded px-1.5 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
                        {formatIpType(row.ipType, t)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium ${badgeClassForAssignment(row.assignmentType)}`}>
                        {formatAssignment(row.assignmentType, t)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDateTime(row.firstSeen, locale)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDateTime(row.lastSeen, locale)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium ${
                        row.isActive ? 'bg-green-500/10 text-green-600' : 'bg-muted text-muted-foreground'
                      }`}>
                        {row.isActive ? t('deviceIpHistory.status.active') : t('deviceIpHistory.status.inactive')}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {t('deviceIpHistory.pagination.showing', {
              start: formatNumber(startIndex + 1, locale),
              end: formatNumber(Math.min(startIndex + PAGE_SIZE, filteredRows.length), locale),
              total: formatNumber(filteredRows.length, locale),
            })}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="rounded-md border px-2 py-1 text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('deviceIpHistory.pagination.first')}
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage === 1}
              className="flex h-9 w-9 items-center justify-center rounded-md border hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[100px] text-center text-sm">
              {t('deviceIpHistory.pagination.page', {
                page: formatNumber(currentPage, locale),
                total: formatNumber(totalPages, locale),
              })}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={currentPage === totalPages}
              className="flex h-9 w-9 items-center justify-center rounded-md border hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="rounded-md border px-2 py-1 text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('deviceIpHistory.pagination.last')}
            </button>
          </div>
        </div>
      )}

      {fetchedCount >= MAX_FETCH_LIMIT && (
        <p className="mt-3 text-xs text-muted-foreground">
          {t('deviceIpHistory.limitNotice', { count: formatNumber(MAX_FETCH_LIMIT, locale) })}
        </p>
      )}
    </div>
  );
}
