import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  AlertTriangle,
  CheckSquare,
  ExternalLink,
  FileText,
  Loader2,
  Minus,
  Monitor,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  Square
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchWithAuth } from '../../stores/auth';
import { navigateTo } from '@/lib/navigation';
import { formatNumber, formatRelativeTime as formatLocalizedRelativeTime } from '@/i18n/formatters';
import { useI18n } from '@/i18n/react';
import { toNumber, type DevicePatchRow } from './patchHelpers';
import { usePatchSelection } from './usePatchSelection';
import { useBulkActions, type BulkActionMessages } from './useBulkActions';

type ComplianceSummary = {
  totalDevices: number;
  compliantDevices: number;
  criticalPatches: number;
  pendingPatches: number;
  rebootPending: number;
};

type PatchComplianceViewProps = {
  ringId?: string | null;
};

export default function PatchComplianceView({ ringId }: PatchComplianceViewProps) {
  const { locale, t } = useI18n();
  const [devices, setDevices] = useState<DevicePatchRow[]>([]);
  const [summary, setSummary] = useState<ComplianceSummary>({ totalDevices: 0, compliantDevices: 0, criticalPatches: 0, pendingPatches: 0, rebootPending: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [exporting, setExporting] = useState(false);
  const [confirmInstall, setConfirmInstall] = useState(false);
  const reportPollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(undefined);
      const params = new URLSearchParams();
      if (ringId) params.set('ringId', ringId);
      const complianceUrl = params.toString() ? `/patches/compliance?${params}` : '/patches/compliance';

      const [complianceRes, devicesRes] = await Promise.all([
        fetchWithAuth(complianceUrl),
        fetchWithAuth('/devices?limit=200')
      ]);
      if (!complianceRes.ok || !devicesRes.ok) {
        if (complianceRes.status === 401 || devicesRes.status === 401) {
          void navigateTo('/login', { replace: true });
          return;
        }
        throw new Error(t('patchComplianceView.errors.fetchPatchData'));
      }

      const complianceData = (await complianceRes.json()).data ?? {};
      const needingList = complianceData.devicesNeedingPatches ?? [];
      const allDevicesPayload = await devicesRes.json();
      const allDevices = allDevicesPayload.devices ?? allDevicesPayload.data ?? allDevicesPayload.items ?? [];

      const needingMap = new Map<string, Record<string, unknown>>();
      if (Array.isArray(needingList)) {
        for (const d of needingList) {
          const id = String(d.id ?? d.deviceId ?? '');
          if (id) needingMap.set(id, d);
        }
      }

      const merged: DevicePatchRow[] = [];
      if (Array.isArray(allDevices)) {
        for (const raw of allDevices) {
          const id = String(raw.id ?? '');
          const n = needingMap.get(id);
          merged.push({
            id,
            hostname: String(n?.name ?? n?.hostname ?? raw.hostname ?? t('patchComplianceView.fallbacks.unknownDevice')),
            osType: String(n?.os ?? n?.osType ?? raw.osType ?? raw.os_type ?? t('patchComplianceView.fallbacks.unknownOs')),
            lastSeenAt: (n?.lastSeen ?? raw.lastSeenAt) ? String(n?.lastSeen ?? raw.lastSeenAt) : undefined,
            pendingPatches: toNumber(n?.missingCount ?? 0),
            criticalMissing: toNumber(n?.criticalCount ?? 0),
            importantMissing: toNumber(n?.importantCount ?? 0),
            osMissing: toNumber(n?.osMissing ?? 0),
            thirdPartyMissing: toNumber(n?.thirdPartyMissing ?? 0),
            lastInstalledAt: n?.lastInstalledAt ? String(n.lastInstalledAt) : undefined,
            lastScannedAt: n?.lastScannedAt ? String(n.lastScannedAt) : undefined,
            pendingReboot: Boolean(n?.pendingReboot),
          });
        }
      }

      merged.sort((a, b) => b.criticalMissing - a.criticalMissing || b.pendingPatches - a.pendingPatches);
      setDevices(merged);

      const nonCompliant = merged.filter(d => d.pendingPatches > 0);
      setSummary({
        totalDevices: merged.length,
        compliantDevices: merged.length - nonCompliant.length,
        criticalPatches: nonCompliant.reduce((sum, d) => sum + d.criticalMissing, 0),
        pendingPatches: nonCompliant.reduce((sum, d) => sum + d.pendingPatches, 0),
        rebootPending: merged.filter(d => d.pendingReboot).length,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('patchComplianceView.errors.fetchPatchData'));
    } finally {
      setLoading(false);
    }
  }, [ringId, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    return () => {
      if (reportPollTimerRef.current) {
        clearInterval(reportPollTimerRef.current);
        reportPollTimerRef.current = null;
      }
    };
  }, []);

  // Filters
  const filteredDevices = useMemo(() => {
    let list = devices;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(d => d.hostname.toLowerCase().includes(q));
    }
    if (statusFilter === 'needs-patches') list = list.filter(d => d.pendingPatches > 0);
    else if (statusFilter === 'critical') list = list.filter(d => d.criticalMissing > 0);
    else if (statusFilter === 'reboot') list = list.filter(d => d.pendingReboot);
    else if (statusFilter === '3rd-party') list = list.filter(d => d.thirdPartyMissing > 0);
    else if (statusFilter === 'compliant') list = list.filter(d => d.pendingPatches === 0);
    return list;
  }, [devices, searchQuery, statusFilter]);

  const hasActiveFilters = searchQuery !== '' || statusFilter !== 'all';

  const resolveInstallPatchIds = useCallback(async (deviceId: string) => {
    const response = await fetchWithAuth(`/devices/${deviceId}/patches`);
    if (!response.ok) {
      if (response.status === 401) {
        void navigateTo('/login', { replace: true });
        return [];
      }
      throw new Error(t('patchComplianceView.errors.loadPendingPatchesForDevice', { deviceId }));
    }

    const payload = await response.json().catch(() => ({}));
    const data = payload?.data ?? payload;
    const pending = data?.pending ?? data?.pendingPatches ?? data?.available ?? [];
    if (!Array.isArray(pending)) {
      return [];
    }

    return pending
      .map((patch: unknown) => (patch && typeof patch === 'object' && 'id' in patch && patch.id ? String(patch.id) : ''))
      .filter((patchId) => patchId.length > 0);
  }, [t]);

  const filteredIds = useMemo(() => filteredDevices.map(d => d.id), [filteredDevices]);
  const bulkMessages = useMemo<BulkActionMessages>(() => {
    const deviceNoun = (count: number) => count === 1
      ? t('patchComplianceView.plurals.deviceOne')
      : t('patchComplianceView.plurals.deviceMany');
    return {
      scanStartFailed: t('patchComplianceView.errors.startPatchScan'),
      scanFallbackFailed: t('patchComplianceView.errors.startScan'),
      scanQueued: (count) => t('patchComplianceView.bulk.scanQueued', { count, deviceNoun: deviceNoun(count) }),
      installQueued: (count) => t('patchComplianceView.bulk.installQueued', { count, deviceNoun: deviceNoun(count) }),
      installFailed: (failedCount, totalCount) =>
        t('patchComplianceView.bulk.installFailed', { failedCount, totalCount }),
      skippedNoPending: (count) =>
        t('patchComplianceView.bulk.skippedNoPending', { count, deviceNoun: deviceNoun(count) }),
      noInstallable: t('patchComplianceView.bulk.noInstallable'),
      installFallbackFailed: t('patchComplianceView.errors.installPatches'),
    };
  }, [t]);
  const { selectedIds, allPageSelected: allSelected, somePageSelected: someSelected, toggleSelect, toggleSelectAll, clearSelection } = usePatchSelection(filteredIds);
  const { bulkAction, bulkError, setBulkError, bulkSuccess, setBulkSuccess, handleBulkScan, handleBulkInstall } = useBulkActions(
    selectedIds,
    clearSelection,
    fetchData,
    { messages: bulkMessages, resolveInstallPatchIds }
  );

  const handleExport = useCallback(async () => {
    try {
      setExporting(true);
      setBulkError(undefined);
      setBulkSuccess(undefined);
      const params = new URLSearchParams();
      if (ringId) params.set('ringId', ringId);
      params.set('format', 'csv');
      const response = await fetchWithAuth(`/patches/compliance/report?${params}`);
      if (!response.ok) {
        if (response.status === 401) { void navigateTo('/login', { replace: true }); return; }
        throw new Error(t('patchComplianceView.errors.generateReport'));
      }
      const result = await response.json();
      const reportId = result.reportId ?? result.data?.id ?? result.id;
      if (reportId) {
        setBulkSuccess(t('patchComplianceView.report.queued', { reportId }));

        if (reportPollTimerRef.current) {
          clearInterval(reportPollTimerRef.current);
        }

        reportPollTimerRef.current = setInterval(async () => {
          try {
            const statusResponse = await fetchWithAuth(`/patches/compliance/report/${reportId}`);
            if (!statusResponse.ok) {
              throw new Error(t('patchComplianceView.errors.checkReportStatus'));
            }
            const payload = await statusResponse.json();
            const report = payload?.data ?? payload;
            if (report?.status === 'completed') {
              if (reportPollTimerRef.current) {
                clearInterval(reportPollTimerRef.current);
                reportPollTimerRef.current = null;
              }
              setBulkSuccess(t('patchComplianceView.report.ready', { reportId }));
              window.location.assign(`/api/v1/patches/compliance/report/${reportId}/download`);
            } else if (report?.status === 'failed') {
              if (reportPollTimerRef.current) {
                clearInterval(reportPollTimerRef.current);
                reportPollTimerRef.current = null;
              }
              setBulkError(report?.errorMessage || t('patchComplianceView.report.failed', { reportId }));
              setBulkSuccess(undefined);
            }
          } catch (err) {
            if (reportPollTimerRef.current) {
              clearInterval(reportPollTimerRef.current);
              reportPollTimerRef.current = null;
            }
            setBulkError(err instanceof Error ? err.message : t('patchComplianceView.errors.checkReportStatus'));
            setBulkSuccess(undefined);
          }
        }, 3000);
      } else {
        setBulkError(t('patchComplianceView.errors.missingReportId'));
      }
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : t('patchComplianceView.errors.generateReport'));
    } finally {
      setExporting(false);
    }
  }, [ringId, setBulkError, setBulkSuccess, t]);

  const selectedPatchDeviceIds = useMemo(() => {
    return Array.from(selectedIds).filter(id => {
      const d = devices.find(dev => dev.id === id);
      return d && d.pendingPatches > 0;
    });
  }, [selectedIds, devices]);
  const selectedWithPatches = selectedPatchDeviceIds.length;

  // Precomputed filter counts
  const filterCounts = useMemo(() => ({
    critical: devices.filter(d => d.criticalMissing > 0).length,
    thirdParty: devices.filter(d => d.thirdPartyMissing > 0).length,
  }), [devices]);

  // Auto-dismiss success banners
  useEffect(() => {
    if (!bulkSuccess) return;
    const timer = setTimeout(() => setBulkSuccess(undefined), 5000);
    return () => clearTimeout(timer);
  }, [bulkSuccess, setBulkSuccess]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && devices.length === 0) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <button type="button" onClick={fetchData} className="mt-3 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
          {t('patchComplianceView.actions.tryAgain')}
        </button>
      </div>
    );
  }

  const compliancePercent = summary.totalDevices > 0
    ? Math.round((summary.compliantDevices / summary.totalDevices) * 100)
    : 100;
  const nonCompliantCount = summary.totalDevices - summary.compliantDevices;
  const formatDisplayNumber = (value: number) => formatNumber(value, locale);
  const deviceNoun = (count: number) => count === 1
    ? t('patchComplianceView.plurals.deviceOne')
    : t('patchComplianceView.plurals.deviceMany');
  const formatRelative = (value: string) => formatLocalizedRelativeTime(value, locale);
  const getLastActivity = (installed?: string, scanned?: string): { label: string; tooltip: string } => {
    const installedTime = installed ? new Date(installed).getTime() : 0;
    const scannedTime = scanned ? new Date(scanned).getTime() : 0;
    if (!installedTime && !scannedTime) {
      return {
        label: t('patchComplianceView.activity.noneLabel'),
        tooltip: t('patchComplianceView.activity.noActivity'),
      };
    }
    if (installedTime >= scannedTime && installed) {
      return {
        label: t('patchComplianceView.activity.installed', { time: formatRelative(installed) }),
        tooltip: scanned
          ? t('patchComplianceView.activity.lastScanned', { time: formatRelative(scanned) })
          : t('patchComplianceView.activity.noScan'),
      };
    }
    return {
      label: scanned ? t('patchComplianceView.activity.scanned', { time: formatRelative(scanned) }) : t('patchComplianceView.activity.noneLabel'),
      tooltip: installed
        ? t('patchComplianceView.activity.lastInstalled', { time: formatRelative(installed) })
        : t('patchComplianceView.activity.noInstall'),
    };
  };

  return (
    <div className="space-y-4">
      {/* Compact compliance summary */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
          <span className="flex items-center gap-1.5 font-semibold">
            <Shield className="h-4 w-4 text-muted-foreground" />
            {t('patchComplianceView.summary.compliantPercent', { percent: formatDisplayNumber(compliancePercent) })}
          </span>
          <span className="text-muted-foreground">
            {t('patchComplianceView.summary.devices', {
              compliant: formatDisplayNumber(summary.compliantDevices),
              total: formatDisplayNumber(summary.totalDevices),
              deviceNoun: deviceNoun(summary.totalDevices),
            })}
          </span>
          {nonCompliantCount > 0 && (
            <span className="flex items-center gap-1 text-orange-600">
              <AlertTriangle className="h-3.5 w-3.5" />
              {t('patchComplianceView.summary.needPatches', { count: formatDisplayNumber(nonCompliantCount) })}
            </span>
          )}
          {summary.criticalPatches > 0 && (
            <span className="text-red-600 font-medium">
              {t('patchComplianceView.summary.critical', { count: formatDisplayNumber(summary.criticalPatches) })}
            </span>
          )}
          {summary.rebootPending > 0 && (
            <span className="flex items-center gap-1 text-orange-600">
              <RotateCcw className="h-3.5 w-3.5" />
              {t('patchComplianceView.summary.reboot', { count: formatDisplayNumber(summary.rebootPending) })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-3 text-xs font-medium hover:bg-muted disabled:opacity-50"
          >
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
            {exporting ? t('patchComplianceView.actions.exporting') : t('patchComplianceView.actions.export')}
          </button>
          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-3 text-xs font-medium hover:bg-muted disabled:opacity-50"
            aria-label={t('patchComplianceView.actions.refresh')}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder={t('patchComplianceView.filters.searchPlaceholder')}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring sm:w-56"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">{t('patchComplianceView.filters.allDevices', { count: formatDisplayNumber(devices.length) })}</option>
          <option value="needs-patches">{t('patchComplianceView.filters.needsPatches', { count: formatDisplayNumber(nonCompliantCount) })}</option>
          <option value="critical">{t('patchComplianceView.filters.critical', { count: formatDisplayNumber(filterCounts.critical) })}</option>
          <option value="reboot">{t('patchComplianceView.filters.reboot', { count: formatDisplayNumber(summary.rebootPending) })}</option>
          <option value="3rd-party">{t('patchComplianceView.filters.thirdParty', { count: formatDisplayNumber(filterCounts.thirdParty) })}</option>
          <option value="compliant">{t('patchComplianceView.filters.compliant', { count: formatDisplayNumber(summary.compliantDevices) })}</option>
        </select>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => { setSearchQuery(''); setStatusFilter('all'); }}
            className="h-9 rounded-md px-3 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            {t('patchComplianceView.actions.clear')}
          </button>
        )}
        {filteredDevices.length !== devices.length && (
          <span className="text-xs text-muted-foreground">
            {t('patchComplianceView.filters.showing', {
              filtered: formatDisplayNumber(filteredDevices.length),
              total: formatDisplayNumber(devices.length),
            })}
          </span>
        )}
      </div>

      {/* Bulk action toolbar */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/50 px-4 py-2.5">
          <span className="text-sm font-medium">
            {t('patchComplianceView.bulk.selected', { count: formatDisplayNumber(selectedIds.size) })}
          </span>
          <div className="h-4 w-px bg-border" />
          <button
            type="button"
            onClick={handleBulkScan}
            disabled={bulkAction !== null}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-3 text-xs font-medium hover:bg-muted disabled:opacity-50"
          >
            {bulkAction === 'scan' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {t('patchComplianceView.actions.scan')}
          </button>
          {selectedWithPatches > 0 && !confirmInstall && (
            <button
              type="button"
              onClick={() => setConfirmInstall(true)}
              disabled={bulkAction !== null}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5" />
              {t('patchComplianceView.actions.installCount', { count: formatDisplayNumber(selectedWithPatches) })}
            </button>
          )}
          {confirmInstall && (
            <div className="flex items-center gap-2 rounded-md border border-orange-500/40 bg-orange-500/10 px-3 py-1">
              <span className="text-xs text-orange-700">
                {t('patchComplianceView.bulk.confirmInstall', {
                  count: formatDisplayNumber(selectedWithPatches),
                  deviceNoun: deviceNoun(selectedWithPatches),
                })}
              </span>
              <button
                type="button"
                onClick={() => { setConfirmInstall(false); void handleBulkInstall(selectedPatchDeviceIds); }}
                disabled={bulkAction !== null}
                className="inline-flex h-6 items-center rounded bg-primary px-2 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {bulkAction === 'install' ? <Loader2 className="h-3 w-3 animate-spin" /> : t('patchComplianceView.actions.confirm')}
              </button>
              <button
                type="button"
                onClick={() => setConfirmInstall(false)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                {t('patchComplianceView.actions.cancel')}
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={clearSelection}
            className="ml-auto h-8 rounded-md px-3 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {t('patchComplianceView.actions.clear')}
          </button>
        </div>
      )}

      {/* Status banners */}
      {bulkError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {bulkError}
        </div>
      )}
      {bulkSuccess && (
        <div className="rounded-md border border-green-500/40 bg-green-500/10 px-4 py-2 text-sm text-green-700">
          {bulkSuccess}
        </div>
      )}

      {/* Device table */}
      <div className="overflow-x-auto rounded-md border">
        <table className="min-w-full divide-y">
          <thead className="bg-muted/40">
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="w-10 px-3 py-3">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="flex items-center justify-center text-muted-foreground hover:text-foreground"
                  aria-label={allSelected ? t('patchComplianceView.selection.deselectAll') : t('patchComplianceView.selection.selectAll')}
                >
                  {allSelected ? <CheckSquare className="h-4 w-4" /> : someSelected ? <Minus className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                </button>
              </th>
              <th className="px-3 py-3">{t('patchComplianceView.columns.device')}</th>
              <th className="px-3 py-3">{t('patchComplianceView.columns.status')}</th>
              <th className="px-3 py-3" title={t('patchComplianceView.tooltips.osPatches')}>{t('patchComplianceView.columns.osPatches')}</th>
              <th className="px-3 py-3" title={t('patchComplianceView.tooltips.thirdParty')}>{t('patchComplianceView.columns.thirdParty')}</th>
              <th className="px-3 py-3" title={t('patchComplianceView.tooltips.critical')}>{t('patchComplianceView.columns.critical')}</th>
              <th className="px-3 py-3" title={t('patchComplianceView.tooltips.lastActivity')}>{t('patchComplianceView.columns.lastActivity')}</th>
              <th className="px-3 py-3" title={t('patchComplianceView.tooltips.reboot')}>{t('patchComplianceView.columns.reboot')}</th>
              <th className="px-3 py-3 text-right">{t('patchComplianceView.columns.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredDevices.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {hasActiveFilters ? t('patchComplianceView.empty.noFilterMatches') : t('patchComplianceView.empty.noDevices')}
                </td>
              </tr>
            ) : (
              filteredDevices.map(device => {
                const isSelected = selectedIds.has(device.id);
                const isCompliant = device.pendingPatches === 0;
                const activity = getLastActivity(device.lastInstalledAt, device.lastScannedAt);

                return (
                  <tr key={device.id} className={cn('text-sm hover:bg-muted/30', isSelected && 'bg-primary/5')}>
                    <td className="w-10 px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => toggleSelect(device.id)}
                        className="flex items-center justify-center text-muted-foreground hover:text-foreground"
                        aria-label={
                          isSelected
                            ? t('patchComplianceView.selection.deselectDevice', { hostname: device.hostname })
                            : t('patchComplianceView.selection.selectDevice', { hostname: device.hostname })
                        }
                      >
                        {isSelected ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4" />}
                      </button>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-muted">
                          <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <a
                            href={`/devices/${device.id}`}
                            className="flex items-center gap-1 text-sm font-medium hover:underline"
                          >
                            <span className="truncate">{device.hostname}</span>
                            <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                          </a>
                          <div className="text-xs text-muted-foreground">
                            {device.osType}
                            {device.lastSeenAt && <> &middot; {formatRelative(device.lastSeenAt)}</>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      {isCompliant ? (
                        <span className="inline-flex items-center rounded-full border border-green-500/40 bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-700">
                          {t('patchComplianceView.status.ok')}
                        </span>
                      ) : device.criticalMissing > 0 ? (
                        <span className="inline-flex items-center rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-700">
                          {t('patchComplianceView.status.missing', { count: formatDisplayNumber(device.pendingPatches) })}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full border border-orange-500/40 bg-orange-500/10 px-2 py-0.5 text-xs font-medium text-orange-700">
                          {t('patchComplianceView.status.missing', { count: formatDisplayNumber(device.pendingPatches) })}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">
                      {device.osMissing > 0 ? device.osMissing : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">
                      {device.thirdPartyMissing > 0 ? (
                        <span className="inline-flex items-center rounded-full border border-violet-500/40 bg-violet-500/10 px-2 py-0.5 text-xs font-medium text-violet-700">
                          {device.thirdPartyMissing}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {device.criticalMissing > 0 ? (
                        <span className="inline-flex items-center rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-700">
                          {device.criticalMissing}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground" title={activity.tooltip}>
                      {activity.label}
                    </td>
                    <td className="px-3 py-2.5">
                      {device.pendingReboot ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-orange-500/40 bg-orange-500/10 px-2 py-0.5 text-xs font-medium text-orange-700">
                          <RotateCcw className="h-3 w-3" />
                          {t('patchComplianceView.status.yes')}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <a
                        href={`/devices/${device.id}#patches`}
                        className="inline-flex h-7 items-center gap-1 rounded-md border px-2.5 text-xs font-medium hover:bg-muted"
                      >
                        {t('patchComplianceView.actions.view')}
                      </a>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
