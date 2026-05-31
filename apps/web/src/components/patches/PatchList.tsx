import { useMemo, useState, useCallback } from 'react';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Download,
  Loader2,
  CheckSquare,
  Square,
  Minus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePatchSelection } from './usePatchSelection';
import { formatDate as formatLocalizedDate, formatNumber } from '@/i18n/formatters';
import { useI18n } from '@/i18n/react';

export type PatchSeverity = 'critical' | 'important' | 'moderate' | 'low';
export type PatchApprovalStatus = 'pending' | 'approved' | 'declined' | 'deferred';

export type Patch = {
  id: string;
  title: string;
  severity: PatchSeverity;
  source: string;
  os: string;
  releaseDate: string;
  approvalStatus: PatchApprovalStatus;
  description?: string;
  vendor?: string | null;
  cveIds?: string[];
};

type PatchListProps = {
  patches: Patch[];
  onReview?: (patch: Patch) => void;
  onDeploy?: (patch: Patch) => void;
  onView?: (patch: Patch) => void;
  onBulkApprove?: (patchIds: string[]) => Promise<void>;
  onBulkDecline?: (patchIds: string[]) => Promise<void>;
  pageSize?: number;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
};

const severityConfig: Record<PatchSeverity, { labelKey: string; color: string }> = {
  critical: { labelKey: 'patchList.severity.critical', color: 'bg-red-500/20 text-red-700 border-red-500/40' },
  important: { labelKey: 'patchList.severity.important', color: 'bg-orange-500/20 text-orange-700 border-orange-500/40' },
  moderate: { labelKey: 'patchList.severity.moderate', color: 'bg-yellow-500/20 text-yellow-700 border-yellow-500/40' },
  low: { labelKey: 'patchList.severity.low', color: 'bg-blue-500/20 text-blue-700 border-blue-500/40' }
};

const approvalConfig: Record<PatchApprovalStatus, { labelKey: string; color: string; icon: typeof CheckCircle }> = {
  pending: { labelKey: 'patchList.approval.pending', color: 'bg-warning/15 text-warning border-warning/30', icon: Clock },
  approved: { labelKey: 'patchList.approval.approved', color: 'bg-success/15 text-success border-success/30', icon: CheckCircle },
  declined: { labelKey: 'patchList.approval.declined', color: 'bg-destructive/15 text-destructive border-destructive/30', icon: XCircle },
  deferred: { labelKey: 'patchList.approval.deferred', color: 'bg-blue-500/20 text-blue-700 border-blue-500/40', icon: Clock }
};

export default function PatchList({
  patches,
  onReview,
  onDeploy,
  onView,
  onBulkApprove,
  onBulkDecline,
  pageSize = 8,
  loading,
  error,
  onRetry
}: PatchListProps) {
  const { locale, t } = useI18n();
  const [query, setQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [osFilter, setOsFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [bulkLoading, setBulkLoading] = useState(false);

  const availableSources = useMemo(() => {
    const sources = new Set(patches.map(patch => patch.source));
    return Array.from(sources).sort();
  }, [patches]);

  const availableOs = useMemo(() => {
    const osList = new Set(patches.map(patch => patch.os));
    return Array.from(osList).sort();
  }, [patches]);

  const filteredPatches = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return patches.filter(patch => {
      const matchesQuery =
        normalizedQuery.length === 0
          ? true
          : patch.title.toLowerCase().includes(normalizedQuery) ||
            patch.description?.toLowerCase().includes(normalizedQuery);
      const matchesSeverity = severityFilter === 'all' ? true : patch.severity === severityFilter;
      const matchesStatus = statusFilter === 'all' ? true : patch.approvalStatus === statusFilter;
      const matchesOs = osFilter === 'all' ? true : patch.os === osFilter;
      const matchesSource = sourceFilter === 'all' ? true : patch.source === sourceFilter;

      return matchesQuery && matchesSeverity && matchesStatus && matchesOs && matchesSource;
    });
  }, [patches, query, severityFilter, statusFilter, osFilter, sourceFilter]);

  const totalPages = Math.ceil(filteredPatches.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedPatches = filteredPatches.slice(startIndex, startIndex + pageSize);

  const paginatedIds = useMemo(() => paginatedPatches.map(p => p.id), [paginatedPatches]);
  const { selectedIds, allPageSelected, somePageSelected, toggleSelect, toggleSelectAll, clearSelection } = usePatchSelection(paginatedIds);

  const selectedPatches = useMemo(
    () => patches.filter(p => selectedIds.has(p.id)),
    [patches, selectedIds]
  );

  const selectedPendingIds = useMemo(
    () => selectedPatches.filter(p => p.approvalStatus !== 'approved' && p.approvalStatus !== 'declined').map(p => p.id),
    [selectedPatches]
  );

  const selectedApprovedIds = useMemo(
    () => selectedPatches.filter(p => p.approvalStatus === 'approved').map(p => p.id),
    [selectedPatches]
  );

  const [bulkError, setBulkError] = useState<string>();

  const handleBulkApprove = useCallback(async () => {
    if (!onBulkApprove || selectedPendingIds.length === 0) return;
    setBulkLoading(true);
    setBulkError(undefined);
    try {
      await onBulkApprove(selectedPendingIds);
      clearSelection();
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : t('patchList.errors.bulkApprove'));
    } finally {
      setBulkLoading(false);
    }
  }, [onBulkApprove, selectedPendingIds, clearSelection]);

  const handleBulkDecline = useCallback(async () => {
    if (!onBulkDecline || selectedPendingIds.length === 0) return;
    setBulkLoading(true);
    setBulkError(undefined);
    try {
      await onBulkDecline(selectedPendingIds);
      clearSelection();
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : t('patchList.errors.bulkDecline'));
    } finally {
      setBulkLoading(false);
    }
  }, [onBulkDecline, selectedPendingIds, clearSelection]);

  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">{t('patchList.title')}</h2>
          <p className="text-sm text-muted-foreground">
            {t('patchList.summary', {
              filtered: formatNumber(filteredPatches.length, locale),
              total: formatNumber(patches.length, locale)
            })}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              placeholder={t('patchList.searchPlaceholder')}
              value={query}
              onChange={event => {
                setQuery(event.target.value);
                setCurrentPage(1);
              }}
              className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring sm:w-48"
            />
          </div>
          <select
            value={severityFilter}
            onChange={event => {
              setSeverityFilter(event.target.value);
              setCurrentPage(1);
            }}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring sm:w-36"
          >
            <option value="all">{t('patchList.filters.allSeverities')}</option>
            <option value="critical">{t('patchList.severity.critical')}</option>
            <option value="important">{t('patchList.severity.important')}</option>
            <option value="moderate">{t('patchList.severity.moderate')}</option>
            <option value="low">{t('patchList.severity.low')}</option>
          </select>
          <select
            value={statusFilter}
            onChange={event => {
              setStatusFilter(event.target.value);
              setCurrentPage(1);
            }}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring sm:w-36"
          >
            <option value="all">{t('patchList.filters.allStatus')}</option>
            <option value="pending">{t('patchList.approval.pending')}</option>
            <option value="approved">{t('patchList.approval.approved')}</option>
            <option value="declined">{t('patchList.approval.declined')}</option>
            <option value="deferred">{t('patchList.approval.deferred')}</option>
          </select>
          <button
            type="button"
            onClick={() => setShowMoreFilters(prev => !prev)}
            className={cn(
              'h-10 rounded-md px-3 text-sm font-medium',
              showMoreFilters || sourceFilter !== 'all' || osFilter !== 'all'
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {showMoreFilters ? t('patchList.actions.lessFilters') : t('patchList.actions.moreFilters')}
            {(sourceFilter !== 'all' || osFilter !== 'all') && !showMoreFilters && (
              <span className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                {formatNumber((sourceFilter !== 'all' ? 1 : 0) + (osFilter !== 'all' ? 1 : 0), locale)}
              </span>
            )}
          </button>
          {showMoreFilters && (
            <>
              <select
                value={sourceFilter}
                onChange={event => {
                  setSourceFilter(event.target.value);
                  setCurrentPage(1);
                }}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring sm:w-40"
              >
                <option value="all">{t('patchList.filters.allSources')}</option>
                {availableSources.map(source => (
                  <option key={source} value={source}>
                    {source}
                  </option>
                ))}
              </select>
              <select
                value={osFilter}
                onChange={event => {
                  setOsFilter(event.target.value);
                  setCurrentPage(1);
                }}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring sm:w-32"
              >
                <option value="all">{t('patchList.filters.allOs')}</option>
                {availableOs.map(os => (
                  <option key={os} value={os}>
                    {os}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
      </div>

      {/* Bulk action toolbar */}
      {selectedIds.size > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border bg-muted/50 px-4 py-3">
          <span className="text-sm font-medium">
            {t('patchList.bulk.selected', { count: formatNumber(selectedIds.size, locale) })}
          </span>
          <div className="h-4 w-px bg-border" />
          {onBulkApprove && selectedPendingIds.length > 0 && (
            <button
              type="button"
              onClick={handleBulkApprove}
              disabled={bulkLoading}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {bulkLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
              {t('patchList.bulk.approve', { count: formatNumber(selectedPendingIds.length, locale) })}
            </button>
          )}
          {onBulkDecline && selectedPendingIds.length > 0 && (
            <button
              type="button"
              onClick={handleBulkDecline}
              disabled={bulkLoading}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-3 text-xs font-medium text-destructive hover:bg-destructive/20 disabled:opacity-50"
            >
              {bulkLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
              {t('patchList.bulk.decline', { count: formatNumber(selectedPendingIds.length, locale) })}
            </button>
          )}
          {onDeploy && selectedApprovedIds.length > 0 && (
            <button
              type="button"
              onClick={() => {
                for (const p of selectedPatches.filter(p => p.approvalStatus === 'approved')) {
                  onDeploy(p);
                }
              }}
              disabled={bulkLoading}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium hover:bg-muted disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              {t('patchList.bulk.deploy', { count: formatNumber(selectedApprovedIds.length, locale) })}
            </button>
          )}
          <button
            type="button"
            onClick={clearSelection}
            className="ml-auto h-8 rounded-md px-3 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {t('patchList.actions.clearSelection')}
          </button>
        </div>
      )}

      {bulkError && (
        <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {bulkError}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
            <p className="mt-4 text-sm text-muted-foreground">{t('patchList.loading')}</p>
          </div>
        </div>
      ) : error && patches.length === 0 ? (
        <div className="mt-6 rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-center">
          <p className="text-sm text-destructive">{error}</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              {t('patchList.actions.tryAgain')}
            </button>
          )}
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-md border">
          <table className="min-w-full divide-y">
            <thead className="bg-muted/40">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="w-10 px-4 py-3">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="flex items-center justify-center text-muted-foreground hover:text-foreground"
                    title={allPageSelected ? t('patchList.selection.deselectAll') : t('patchList.selection.selectAll')}
                    aria-label={allPageSelected ? t('patchList.selection.deselectAllPatches') : t('patchList.selection.selectAllPatches')}
                  >
                    {allPageSelected ? (
                      <CheckSquare className="h-4 w-4" />
                    ) : somePageSelected ? (
                      <Minus className="h-4 w-4" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </button>
                </th>
                <th className="px-4 py-3">{t('patchList.columns.patch')}</th>
                <th className="px-4 py-3">{t('patchList.columns.severity')}</th>
                <th className="px-4 py-3">{t('patchList.columns.source')}</th>
                <th className="px-4 py-3">{t('patchList.columns.os')}</th>
                <th className="px-4 py-3">{t('patchList.columns.release')}</th>
                <th className="px-4 py-3">{t('patchList.columns.approval')}</th>
                <th className="px-4 py-3 text-right">{t('patchList.columns.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {paginatedPatches.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-sm text-muted-foreground">
                    {t('patchList.empty')}
                  </td>
                </tr>
              ) : (
                paginatedPatches.map(patch => {
                  const severity = severityConfig[patch.severity];
                  const approval = approvalConfig[patch.approvalStatus];
                  const ApprovalIcon = approval.icon;
                  const isSelected = selectedIds.has(patch.id);

                  return (
                    <tr key={patch.id} className={cn('text-sm', isSelected && 'bg-primary/5')}>
                      <td className="w-10 px-4 py-3">
                        <button
                          type="button"
                          onClick={() => toggleSelect(patch.id)}
                          className="flex items-center justify-center text-muted-foreground hover:text-foreground"
                          aria-label={isSelected
                            ? t('patchList.selection.deselectPatch', { patchTitle: patch.title })
                            : t('patchList.selection.selectPatch', { patchTitle: patch.title })}
                        >
                          {isSelected ? (
                            <CheckSquare className="h-4 w-4 text-primary" />
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">
                          {patch.title}
                          {patch.source === 'third_party' && patch.vendor && (
                            <span
                              data-testid={`patch-row-${patch.id}-vendor`}
                              className="ml-2 text-xs text-muted-foreground font-normal"
                            >
                              {t('patchList.labels.vendorBy', { vendor: patch.vendor })}
                            </span>
                          )}
                        </div>
                        {patch.cveIds && patch.cveIds.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {patch.cveIds.slice(0, 3).map((cve) => (
                              <a
                                key={cve}
                                data-testid={`patch-row-${patch.id}-cve-${cve}`}
                                href={`https://nvd.nist.gov/vuln/detail/${cve}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-red-100 text-red-700 hover:bg-red-200"
                              >
                                {cve}
                              </a>
                            ))}
                            {patch.cveIds.length > 3 && (
                              <span className="text-[10px] text-muted-foreground">
                                {t('patchList.labels.moreCves', { count: formatNumber(patch.cveIds.length - 3, locale) })}
                              </span>
                            )}
                          </div>
                        )}
                        {patch.description && (
                          <div className="text-xs text-muted-foreground">{patch.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium', severity.color)}>
                          {t(severity.labelKey)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{patch.source}</td>
                      <td className="px-4 py-3 text-muted-foreground">{patch.os}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatLocalizedDate(patch.releaseDate, locale)}</td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium', approval.color)}>
                          <ApprovalIcon className="h-3.5 w-3.5" />
                          {t(approval.labelKey)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {patch.approvalStatus === 'approved' ? (
                            <button
                              type="button"
                              onClick={() => onDeploy?.(patch)}
                              className="inline-flex h-8 items-center gap-1 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:opacity-90"
                            >
                              <Download className="h-3.5 w-3.5" />
                              {t('patchList.actions.deploy')}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onReview?.(patch)}
                              className="inline-flex h-8 items-center gap-1 rounded-md border px-3 text-xs font-medium hover:bg-muted"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              {t('patchList.actions.review')}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onView?.(patch)}
                            className="inline-flex h-8 items-center gap-1 rounded-md border px-3 text-xs font-medium text-muted-foreground hover:text-foreground"
                          >
                            {t('patchList.actions.details')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {t('patchList.pagination.page', {
              page: formatNumber(currentPage, locale),
              totalPages: formatNumber(totalPages, locale)
            })}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
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
