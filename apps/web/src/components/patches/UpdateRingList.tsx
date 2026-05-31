import { useMemo, useState } from 'react';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate as formatLocalizedDate, formatNumber } from '@/i18n/formatters';
import { useI18n } from '@/i18n/react';
import type { Locale } from '@/i18n/locales';
import type { TranslationParams } from '@/i18n/resources';

export type UpdateRingStatus = 'active' | 'disabled';

export type CategoryRule = {
  category: string;
  autoApprove: boolean;
  autoApproveSeverities?: Array<'critical' | 'important' | 'moderate' | 'low'>;
  deferralDaysOverride?: number | null;
};

export type UpdateRingItem = {
  id: string;
  name: string;
  description?: string | null;
  enabled: boolean;
  ringOrder: number;
  deferralDays: number;
  deadlineDays?: number | null;
  gracePeriodHours: number;
  categoryRules?: CategoryRule[];
  compliancePercent?: number;
  deviceCount?: number;
  updatedAt?: string;
};

type UpdateRingListProps = {
  rings: UpdateRingItem[];
  onEdit?: (ring: UpdateRingItem) => void;
  onDelete?: (ring: UpdateRingItem) => void;
  onSelect?: (ring: UpdateRingItem) => void;
  pageSize?: number;
};

type Translate = (key: string, params?: TranslationParams, fallback?: string) => string;

function formatDate(dateString: string | undefined, locale: Locale): string {
  if (!dateString) return '\u2014';
  return formatLocalizedDate(dateString, locale);
}

function formatDays(value: number | null | undefined, locale: Locale, t: Translate): string {
  if (value == null || value === 0) return t('updateRingList.none');
  return t('updateRingList.days', { count: formatNumber(value, locale) });
}

function ComplianceBadge({ percent, locale }: { percent?: number; locale: Locale }) {
  if (percent === undefined) return <span className="text-muted-foreground">{"\u2014"}</span>;

  const color =
    percent >= 90
      ? 'bg-success/15 text-success border-success/30'
      : percent >= 70
        ? 'bg-warning/15 text-warning border-warning/30'
        : 'bg-destructive/15 text-destructive border-destructive/30';

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium',
        color
      )}
    >
      {formatNumber(percent, locale)}%
    </span>
  );
}

export default function UpdateRingList({
  rings,
  onEdit,
  onDelete,
  onSelect,
  pageSize = 8,
}: UpdateRingListProps) {
  const { locale, t } = useI18n();
  const [query, setQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const filteredRings = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return rings.filter((ring) => {
      if (normalizedQuery.length === 0) return true;
      return (
        ring.name.toLowerCase().includes(normalizedQuery) ||
        ring.description?.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [rings, query]);

  const totalPages = Math.ceil(filteredRings.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedRings = filteredRings.slice(startIndex, startIndex + pageSize);

  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-lg font-semibold">{t('updateRingList.title')}</h2>
            <p className="text-sm text-muted-foreground">
              {t('updateRingList.summary', {
                filtered: formatNumber(filteredRings.length, locale),
                total: formatNumber(rings.length, locale),
              })}
            </p>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder={t('updateRingList.searchPlaceholder')}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring sm:w-48"
          />
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-md border">
        <table className="min-w-full divide-y">
          <thead className="bg-muted/40">
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3">{t('updateRingList.columns.order')}</th>
              <th className="px-4 py-3">{t('updateRingList.columns.ring')}</th>
              <th className="px-4 py-3">{t('updateRingList.columns.deferral')}</th>
              <th className="px-4 py-3">{t('updateRingList.columns.deadline')}</th>
              <th className="px-4 py-3">{t('updateRingList.columns.devices')}</th>
              <th className="px-4 py-3">{t('updateRingList.columns.compliance')}</th>
              <th className="px-4 py-3">{t('updateRingList.columns.updated')}</th>
              <th className="px-4 py-3 text-right">{t('updateRingList.columns.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {paginatedRings.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-6 text-center text-sm text-muted-foreground"
                >
                  {t('updateRingList.empty')}
                </td>
              </tr>
            ) : (
              paginatedRings.map((ring) => (
                <tr key={ring.id} className="text-sm">
                  <td className="px-4 py-3">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {formatNumber(ring.ringOrder, locale)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onSelect?.(ring)}
                      className="text-left"
                    >
                      <div className="font-medium text-foreground hover:text-primary">
                        {ring.name}
                      </div>
                      {ring.description && (
                        <div className="text-xs text-muted-foreground line-clamp-1">
                          {ring.description}
                        </div>
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDays(ring.deferralDays, locale, t)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDays(ring.deadlineDays, locale, t)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {ring.deviceCount == null ? '\u2014' : formatNumber(ring.deviceCount, locale)}
                  </td>
                  <td className="px-4 py-3">
                    <ComplianceBadge percent={ring.compliancePercent} locale={locale} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDate(ring.updatedAt, locale)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => onEdit?.(ring)}
                        aria-label={t('updateRingList.actions.edit', { name: ring.name })}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border hover:bg-muted"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete?.(ring)}
                        aria-label={t('updateRingList.actions.delete', { name: ring.name })}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {t('updateRingList.pagination.page', {
              page: formatNumber(currentPage, locale),
              totalPages: formatNumber(totalPages, locale),
            })}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
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
