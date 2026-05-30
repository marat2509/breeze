import { useMemo, useState, useEffect, useRef } from 'react';
import { Search, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ArrowUpDown, MoreHorizontal, MoreVertical, Filter, Terminal, FileCode, RotateCcw, Settings, Trash2, Zap } from 'lucide-react';
import type { DesktopAccessState, FilterConditionGroup, RemoteAccessPolicy } from '@breeze/shared';
import { fetchWithAuth } from '../../stores/auth';
import ConnectDesktopButton from '../remote/ConnectDesktopButton';
import { widthPercentClass } from '@/lib/utils';
import { formatLastSeen } from '@/lib/formatTime';
import { DEVICE_ROLES, getDeviceRoleLabel, getDeviceRoleIcon, type DeviceRole } from '@/lib/deviceRoles';
import {
  PAGE_SIZE_OPTIONS,
  readPageSizePreference,
  writePageSizePreference,
} from './pageSizePreference';
import { useI18n } from '@/i18n/react';

export type DeviceStatus = 'online' | 'offline' | 'maintenance' | 'decommissioned' | 'quarantined' | 'updating' | 'pending';
export type OSType = 'windows' | 'macos' | 'linux';

export type Device = {
  id: string;
  hostname: string;
  os: OSType;
  osVersion: string;
  status: DeviceStatus;
  cpuPercent: number;
  ramPercent: number;
  lastSeen: string;
  orgId: string;
  orgName: string;
  siteId: string;
  siteName: string;
  agentVersion: string;
  tags: string[];
  lastUser?: string;
  uptimeSeconds?: number;
  deviceRole?: DeviceRole;
  deviceRoleSource?: string;
  displayName?: string;
  isHeadless?: boolean;
  desktopAccess?: DesktopAccessState | null;
  remoteAccessPolicy?: RemoteAccessPolicy | null;
  /**
   * Server-detected asymmetry: timestamp at which the API stopped
   * receiving main-agent heartbeats while the watchdog is still
   * reporting in. Set by the heartbeat handler (#851 / Layer C).
   * Null when the agent is heartbeating normally or has fully gone
   * silent (watchdog included).
   */
  mainAgentSilentSince?: string | null;
  /**
   * Watchdog reachability as last reported. 'connected' = normal,
   * 'failover' = watchdog took over because main-agent stopped,
   * 'offline' = we haven't heard from the watchdog either (in which
   * case `status === 'offline'` is the load-bearing signal).
   */
  watchdogStatus?: 'connected' | 'failover' | 'offline' | null;
};

type DeviceListProps = {
  devices: Device[];
  orgs?: { id: string; name: string }[];
  sites?: { id: string; name: string }[];
  groups?: { id: string; name: string; type: 'static' | 'dynamic'; deviceCount: number }[];
  groupMembershipMap?: Map<string, Set<string>>;
  onCreateGroup?: () => void;
  autoSelectGroupId?: string | null;
  onAutoSelectConsumed?: () => void;
  timezone?: string;
  onSelect?: (device: Device) => void;
  onAction?: (action: string, device: Device) => void;
  onBulkAction?: (action: string, devices: Device[]) => void;
  // Initial page size if the user has no stored preference for this browser.
  // Once the component mounts, the live page size comes from localStorage
  // (see pageSizePreference.ts); subsequent changes to this prop are ignored.
  pageSize?: number;
  serverFilter?: FilterConditionGroup | null;
};

const statusColors: Record<DeviceStatus, string> = {
  online: 'bg-success/15 text-success border-success/30',
  offline: 'bg-destructive/15 text-destructive border-destructive/30',
  maintenance: 'bg-warning/15 text-warning border-warning/30',
  decommissioned: 'bg-muted text-muted-foreground border-border',
  quarantined: 'bg-warning/15 text-warning border-warning/30',
  updating: 'bg-info/15 text-info border-info/30',
  pending: 'bg-muted text-muted-foreground border-border'
};

const statusLabels: Record<DeviceStatus, string> = {
  online: 'Online',
  offline: 'Offline',
  maintenance: 'Maintenance',
  decommissioned: 'Decommissioned',
  quarantined: 'Quarantined',
  updating: 'Updating',
  pending: 'Pending'
};

/**
 * "Agent silent (watchdog OK)" amber badge. Fires when the server-side
 * asymmetry detector (#851 / Layer C) has marked `mainAgentSilentSince`
 * AND the watchdog is still reporting in (`watchdogStatus !== 'offline'`).
 * That state means the main agent has wedged but the box is alive — a
 * different failure mode from a fully-offline device, and the distinction
 * is the whole point of #800.
 *
 * Returns null when no asymmetry is present so the cell stays clean.
 */
function shouldShowAgentSilentBadge(device: Pick<Device, 'mainAgentSilentSince' | 'watchdogStatus'>): boolean {
  return Boolean(device.mainAgentSilentSince) && device.watchdogStatus !== 'offline';
}

function formatSilentDuration(silentSince: string): string {
  const minutes = Math.max(1, Math.floor((Date.now() - new Date(silentSince).getTime()) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

const osLabels: Record<OSType, string> = {
  windows: 'Windows',
  macos: 'macOS',
  linux: 'Linux'
};

type SortField = 'hostname' | 'status' | 'cpuPercent' | 'ramPercent' | 'lastSeen' | null;
type SortDirection = 'asc' | 'desc';

export default function DeviceList({
  devices,
  orgs = [],
  sites = [],
  groups = [],
  groupMembershipMap = new Map(),
  onCreateGroup,
  autoSelectGroupId,
  onAutoSelectConsumed,
  timezone,
  onSelect,
  onAction,
  onBulkAction,
  pageSize = 10,
  serverFilter = null
}: DeviceListProps) {
  const { t } = useI18n();
  // Use provided timezone or browser default
  const effectiveTimezone = timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [osFilter, setOsFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [orgFilter, setOrgFilter] = useState<string>('all');
  const [siteFilter, setSiteFilter] = useState<string>('all');
  const [groupFilter, setGroupFilter] = useState<string[]>([]);
  const [groupDropdownOpen, setGroupDropdownOpen] = useState(false);
  const groupDropdownRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(1);
  // effectivePageSize is the live, user-controllable page size. Initialized
  // from localStorage (per-user, this-browser persistence) and falls back
  // to the pageSize prop default for callers that supply one. See
  // pageSizePreference.ts for the storage contract and allowed-set guard.
  const [effectivePageSize, setEffectivePageSize] = useState<number>(() =>
    readPageSizePreference(pageSize),
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false);
  const [rowMenuOpenId, setRowMenuOpenId] = useState<string | null>(null);
  // Flip the row dropdown direction when the click happens close to the
  // viewport bottom — the menu has ~7 items × ~36px, so any row whose
  // kebab sits <300px from the viewport bottom would otherwise render
  // its dropdown into the area below the table and get clipped.
  const [rowMenuFlipUp, setRowMenuFlipUp] = useState(false);
  const rowMenuRef = useRef<HTMLDivElement>(null);
  const [serverFilterIds, setServerFilterIds] = useState<Set<string> | null>(null);
  const [serverFilterLoading, setServerFilterLoading] = useState(false);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Close row action menu on outside click
  useEffect(() => {
    if (!rowMenuOpenId) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (rowMenuRef.current && !rowMenuRef.current.contains(e.target as Node)) {
        setRowMenuOpenId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [rowMenuOpenId]);

  // Close group dropdown on outside click
  useEffect(() => {
    if (!groupDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (groupDropdownRef.current && !groupDropdownRef.current.contains(e.target as Node)) {
        setGroupDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [groupDropdownOpen]);

  // Auto-select a newly created group
  useEffect(() => {
    if (autoSelectGroupId && groups.some(g => g.id === autoSelectGroupId)) {
      setGroupFilter(prev =>
        prev.includes(autoSelectGroupId) ? prev : [...prev, autoSelectGroupId]
      );
      onAutoSelectConsumed?.();
    }
  }, [autoSelectGroupId, groups, onAutoSelectConsumed]);

  // Fetch matching device IDs from server when advanced filter changes
  useEffect(() => {
    if (!serverFilter) {
      setServerFilterIds(null);
      return;
    }

    const hasValidConditions = serverFilter.conditions.some(c => {
      if ('conditions' in c) return true;
      return c.value !== '' && c.value !== null && c.value !== undefined;
    });

    if (!hasValidConditions) {
      setServerFilterIds(null);
      return;
    }

    setServerFilterLoading(true);
    const controller = new AbortController();

    fetchWithAuth('/filters/preview', {
      method: 'POST',
      body: JSON.stringify({ conditions: serverFilter, limit: 100 }),
      signal: controller.signal
    })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          const result = data.data ?? data;
          const ids = new Set<string>((result.devices ?? []).map((d: { id: string }) => d.id));
          setServerFilterIds(ids);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          console.error('Filter preview failed:', err);
          setServerFilterIds(null);
        }
      })
      .finally(() => setServerFilterLoading(false));

    return () => controller.abort();
  }, [serverFilter]);

  const filteredDevices = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return devices.filter(device => {
      // Apply server-side advanced filter
      if (serverFilterIds !== null && !serverFilterIds.has(device.id)) {
        return false;
      }

      const matchesQuery = normalizedQuery.length === 0
        ? true
        : device.hostname.toLowerCase().includes(normalizedQuery) ||
          (device.displayName?.toLowerCase().includes(normalizedQuery) ?? false);
      const matchesStatus = statusFilter === 'all'
        ? device.status !== 'decommissioned'
        : device.status === statusFilter;
      const matchesOs = osFilter === 'all' ? true : device.os === osFilter;
      const matchesRole = roleFilter === 'all' ? true : device.deviceRole === roleFilter;
      const matchesOrg = orgFilter === 'all' ? true : device.orgId === orgFilter;
      const matchesSite = siteFilter === 'all' ? true : device.siteId === siteFilter;
      const matchesGroup = groupFilter.length === 0
        ? true
        : groupFilter.some(gId => groupMembershipMap.get(gId)?.has(device.id));

      return matchesQuery && matchesStatus && matchesOs && matchesRole && matchesOrg && matchesSite && matchesGroup;
    });
  }, [devices, query, statusFilter, osFilter, roleFilter, orgFilter, siteFilter, groupFilter, groupMembershipMap, serverFilterIds]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedDevices = useMemo(() => {
    if (!sortField) return filteredDevices;

    return [...filteredDevices].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'hostname':
          cmp = a.hostname.localeCompare(b.hostname);
          break;
        case 'status':
          cmp = a.status.localeCompare(b.status);
          break;
        case 'cpuPercent':
          cmp = a.cpuPercent - b.cpuPercent;
          break;
        case 'ramPercent':
          cmp = a.ramPercent - b.ramPercent;
          break;
        case 'lastSeen': {
          const aTime = new Date(a.lastSeen).getTime() || 0;
          const bTime = new Date(b.lastSeen).getTime() || 0;
          cmp = aTime - bTime;
          break;
        }
      }
      return sortDirection === 'desc' ? -cmp : cmp;
    });
  }, [filteredDevices, sortField, sortDirection]);

  const moreFiltersCount = [roleFilter, orgFilter, siteFilter].filter(f => f !== 'all').length + (groupFilter.length > 0 ? 1 : 0);

  const totalPages = Math.ceil(sortedDevices.length / effectivePageSize);

  // Adjust currentPage during render when filters/search shrink the result
  // set below it. Setting state during render is React's documented way to
  // correct derived state without a flash of stale UI — React discards the
  // in-progress render and re-runs with the corrected value.
  if (totalPages > 0 && currentPage > totalPages) {
    setCurrentPage(1);
  }

  const startIndex = (currentPage - 1) * effectivePageSize;
  const paginatedDevices = sortedDevices.slice(startIndex, startIndex + effectivePageSize);

  const handlePageSizeChange = (newSize: number) => {
    setEffectivePageSize(newSize);
    writePageSizePreference(newSize);
    // Reset to page 1 so the user doesn't land out-of-range when shrinking
    // the page (and gets a coherent first-page view when growing it).
    setCurrentPage(1);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(paginatedDevices.map(d => d.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedIds(newSet);
  };

  const handleBulkAction = (action: string) => {
    const selectedDevices = devices.filter(d => selectedIds.has(d.id));
    onBulkAction?.(action, selectedDevices);
    setBulkMenuOpen(false);
    setSelectedIds(new Set());
  };

  const allSelected = paginatedDevices.length > 0 && paginatedDevices.every(d => selectedIds.has(d.id));
  const someSelected = paginatedDevices.some(d => selectedIds.has(d.id));
  const statusLabel = (status: DeviceStatus) => t(`devices.status.${status}`, undefined, statusLabels[status]);
  const roleLabel = (role: string) => t(`devices.roles.${role}`, undefined, getDeviceRoleLabel(role));
  const osLabel = (os: OSType) => t(`devices.osNames.${os}`, undefined, osLabels[os]);

  return (
    <div>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {t('devices.list.summary', {
              filtered: filteredDevices.length,
              total: statusFilter === 'all' ? devices.filter(d => d.status !== 'decommissioned').length : devices.length,
            })}
            {serverFilterIds !== null && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                <Filter className="h-3 w-3" />
                {t('devices.list.advancedFilterActive')}
                {serverFilterLoading && <span className="ml-1 animate-pulse">...</span>}
              </span>
            )}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                placeholder={t('devices.list.searchPlaceholder')}
                value={query}
                onChange={event => {
                  setQuery(event.target.value);
                  setCurrentPage(1);
                }}
                className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring sm:w-56"
              />
            </div>
            <select
              value={statusFilter}
              aria-label={t('devices.list.filterByStatus')}
              onChange={event => {
                setStatusFilter(event.target.value);
                setCurrentPage(1);
              }}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring sm:w-32"
            >
              <option value="all">{t('devices.list.allStatus')}</option>
              <option value="online">{statusLabel('online')}</option>
              <option value="offline">{statusLabel('offline')}</option>
              <option value="maintenance">{statusLabel('maintenance')}</option>
              <option value="decommissioned">{statusLabel('decommissioned')}</option>
            </select>
            <select
              value={osFilter}
              aria-label={t('devices.list.filterByOs')}
              onChange={event => {
                setOsFilter(event.target.value);
                setCurrentPage(1);
              }}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring sm:w-32"
            >
              <option value="all">{t('devices.list.allOs')}</option>
              <option value="windows">{osLabel('windows')}</option>
              <option value="macos">{osLabel('macos')}</option>
              <option value="linux">{osLabel('linux')}</option>
            </select>
            <button
              type="button"
              onClick={() => setShowMoreFilters(!showMoreFilters)}
              className="h-10 whitespace-nowrap rounded-md border px-3 text-sm font-medium hover:bg-muted flex items-center gap-1.5"
            >
              <Filter className="h-3.5 w-3.5" />
              {t('devices.list.more')}
              {moreFiltersCount > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                  {moreFiltersCount}
                </span>
              )}
            </button>
            {(query || statusFilter !== 'all' || osFilter !== 'all' || roleFilter !== 'all' || orgFilter !== 'all' || siteFilter !== 'all' || groupFilter.length > 0) && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setStatusFilter('all');
                  setOsFilter('all');
                  setRoleFilter('all');
                  setOrgFilter('all');
                  setSiteFilter('all');
                  setGroupFilter([]);
                  setCurrentPage(1);
                }}
                className="h-10 whitespace-nowrap rounded-md px-3 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
                {t('devices.list.clearFilters')}
              </button>
            )}
          </div>
        </div>
        <div className={`grid transition-[grid-template-rows] duration-200 ease-out ${showMoreFilters ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
          <div className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <select
                value={roleFilter}
                aria-label={t('devices.list.filterByRole')}
                onChange={event => {
                  setRoleFilter(event.target.value);
                  setCurrentPage(1);
                }}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring sm:w-36"
              >
                <option value="all">{t('devices.list.allRoles')}</option>
                {DEVICE_ROLES.map(role => (
                  <option key={role} value={role}>
                    {roleLabel(role)}
                  </option>
                ))}
              </select>
              {orgs.length > 0 && (
                <select
                  value={orgFilter}
                  aria-label={t('devices.list.filterByOrganization')}
                  onChange={event => {
                    setOrgFilter(event.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring sm:w-40"
                >
                  <option value="all">{t('devices.list.allOrgs')}</option>
                  {orgs.map(org => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              )}
              {sites.length > 0 && (
                <select
                  value={siteFilter}
                  aria-label={t('devices.list.filterBySite')}
                  onChange={event => {
                    setSiteFilter(event.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring sm:w-40"
                >
                  <option value="all">{t('devices.list.allSites')}</option>
                  {sites.map(site => (
                    <option key={site.id} value={site.id}>
                      {site.name}
                    </option>
                  ))}
                </select>
              )}
              {groups.length > 0 && (
                <div className="relative" ref={groupDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setGroupDropdownOpen(!groupDropdownOpen)}
                    className="h-10 whitespace-nowrap rounded-md border bg-background px-3 text-sm font-medium hover:bg-muted flex items-center gap-1.5"
                  >
                    {t('devices.list.groups')}
                    {groupFilter.length > 0 && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                        {groupFilter.length}
                      </span>
                    )}
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                  {groupDropdownOpen && (
                    <div className="absolute left-0 top-full z-20 mt-1 w-64 rounded-md border bg-card shadow-lg">
                      <div className="max-h-48 overflow-y-auto p-2">
                        {groups.map(group => (
                          <label key={group.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted">
                            <input
                              type="checkbox"
                              checked={groupFilter.includes(group.id)}
                              onChange={() => {
                                setGroupFilter(prev =>
                                  prev.includes(group.id)
                                    ? prev.filter(id => id !== group.id)
                                    : [...prev, group.id]
                                );
                                setCurrentPage(1);
                              }}
                              className="h-4 w-4 rounded border-border"
                            />
                            <span className="text-sm truncate">{group.name}</span>
                            <span className="ml-auto text-[10px] text-muted-foreground">
                              {t(`devices.groupTypes.${group.type}`, undefined, group.type)}
                            </span>
                          </label>
                        ))}
                      </div>
                      <div className="border-t px-2 py-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setGroupDropdownOpen(false);
                            onCreateGroup?.();
                          }}
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          {t('devices.list.newGroup')}
                        </button>
                        <a
                          href="/devices/groups"
                          className="text-xs text-muted-foreground hover:text-foreground ml-auto"
                        >
                          {t('devices.list.manageGroups')}
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="mt-4 flex items-center gap-3 rounded-md border bg-muted/40 px-4 py-2">
          <span className="text-sm font-medium">{t('devices.list.selected', { count: selectedIds.size })}</span>
          <div className="relative">
            <button
              type="button"
              onClick={() => setBulkMenuOpen(!bulkMenuOpen)}
              className="flex items-center gap-1 rounded-md border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted"
            >
              {t('devices.list.bulkActions')}
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {bulkMenuOpen && (
              <div className="absolute left-0 top-full z-10 mt-1 w-48 rounded-md border bg-card shadow-lg">
                <button
                  type="button"
                  onClick={() => handleBulkAction('reboot')}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-muted"
                >
                  {t('devices.list.rebootSelected')}
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkAction('run-script')}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-muted"
                >
                  {t('devices.list.runScript')}
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkAction('deploy-software')}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-muted"
                >
                  {t('devices.list.deploySoftware')}
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkAction('maintenance-on')}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-muted"
                >
                  {t('devices.list.enableMaintenance')}
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkAction('maintenance-off')}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-muted"
                >
                  {t('devices.list.disableMaintenance')}
                </button>
                <hr className="my-1" />
                <button
                  type="button"
                  onClick={() => handleBulkAction('wake')}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-muted"
                >
                  {t('devices.list.wakeSelected')}
                </button>
                <hr className="my-1" />
                <button
                  type="button"
                  onClick={() => handleBulkAction('decommission')}
                  className="w-full px-4 py-2 text-left text-sm text-destructive hover:bg-destructive/10"
                >
                  {t('devices.list.decommissionSelected')}
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            {t('devices.list.clearSelection')}
          </button>
        </div>
      )}

      <div className="mt-6 rounded-md border">
        <table className="w-full divide-y">
          <thead className="bg-muted/40">
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  aria-label={t('devices.list.selectAllPage')}
                  ref={el => {
                    if (el) el.indeterminate = someSelected && !allSelected;
                  }}
                  onChange={e => handleSelectAll(e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
              </th>
              <th
                className="px-3 py-3 cursor-pointer select-none hover:text-foreground"
                title={t('devices.list.sortByHostname')}
                onClick={() => handleSort('hostname')}
              >
                <span className="inline-flex items-center gap-1">
                  {t('devices.list.hostname')}
                  {sortField === 'hostname' ? (
                    sortDirection === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ArrowUpDown className="h-3 w-3 opacity-30" />
                  )}
                </span>
              </th>
              <th className="px-3 py-3">{t('devices.list.organization')}</th>
              <th className="px-3 py-3">{t('devices.list.site')}</th>
              <th className="px-3 py-3">{t('devices.list.os')}</th>
              <th className="px-3 py-3">{t('devices.list.role')}</th>
              <th
                className="px-3 py-3 cursor-pointer select-none hover:text-foreground"
                title={t('devices.list.sortByStatus')}
                onClick={() => handleSort('status')}
              >
                <span className="inline-flex items-center gap-1">
                  {t('devices.list.status')}
                  {sortField === 'status' ? (
                    sortDirection === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ArrowUpDown className="h-3 w-3 opacity-30" />
                  )}
                </span>
              </th>
              <th
                className="px-3 py-3 cursor-pointer select-none hover:text-foreground"
                title={t('devices.list.sortByCpu')}
                onClick={() => handleSort('cpuPercent')}
              >
                <span className="inline-flex items-center gap-1">
                  {t('devices.list.cpu')}
                  {sortField === 'cpuPercent' ? (
                    sortDirection === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ArrowUpDown className="h-3 w-3 opacity-30" />
                  )}
                </span>
              </th>
              <th
                className="px-3 py-3 cursor-pointer select-none hover:text-foreground"
                title={t('devices.list.sortByRam')}
                onClick={() => handleSort('ramPercent')}
              >
                <span className="inline-flex items-center gap-1">
                  {t('devices.list.ram')}
                  {sortField === 'ramPercent' ? (
                    sortDirection === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ArrowUpDown className="h-3 w-3 opacity-30" />
                  )}
                </span>
              </th>
              <th
                className="px-3 py-3 cursor-pointer select-none hover:text-foreground"
                title={t('devices.list.sortByLastSeen')}
                onClick={() => handleSort('lastSeen')}
              >
                <span className="inline-flex items-center gap-1">
                  {t('devices.list.lastSeen')}
                  {sortField === 'lastSeen' ? (
                    sortDirection === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ArrowUpDown className="h-3 w-3 opacity-30" />
                  )}
                </span>
              </th>
              <th className="px-3 py-3 text-right">{t('devices.list.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {paginatedDevices.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-3 py-6 text-center text-sm text-muted-foreground">
                  {t('devices.list.emptyFiltered')}
                </td>
              </tr>
            ) : (
              paginatedDevices.map(device => (
                <tr
                  key={device.id}
                  onClick={() => onSelect?.(device)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelect?.(device);
                    }
                  }}
                  className="cursor-pointer transition hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
                >
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(device.id)}
                      aria-label={t('devices.list.selectDevice', { hostname: device.hostname })}
                      onClick={e => e.stopPropagation()}
                      onChange={e => handleSelectOne(device.id, e.target.checked)}
                      className="h-4 w-4 rounded border-border"
                    />
                  </td>
                  <td className="max-w-[200px] px-3 py-3 text-sm font-medium">
                    <span className="block truncate" title={device.displayName || device.hostname}>{device.displayName || device.hostname}</span>
                  </td>
                  <td className="max-w-[160px] px-3 py-3 text-sm text-muted-foreground">
                    <span className="block truncate" title={device.orgName}>{device.orgName}</span>
                  </td>
                  <td className="max-w-[160px] px-3 py-3 text-sm text-muted-foreground">
                    <span className="block truncate" title={device.siteName}>{device.siteName}</span>
                  </td>
                  <td className="px-3 py-3 text-sm">{osLabel(device.os)}</td>
                  <td className="px-3 py-3 text-sm">
                    {(() => {
                      const role = device.deviceRole ?? 'unknown';
                      const RoleIcon = getDeviceRoleIcon(role);
                      return (
                        <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted/50 px-2.5 py-1 text-xs font-medium">
                          <RoleIcon className="h-3 w-3" />
                          {roleLabel(role)}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-3 py-3 text-sm">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${statusColors[device.status]}`}>
                        {statusLabel(device.status)}
                      </span>
                      {shouldShowAgentSilentBadge(device) && (
                        <span
                          data-testid={`device-${device.id}-agent-silent-badge`}
                          title={t('devices.list.agentSilentTitle', { duration: formatSilentDuration(device.mainAgentSilentSince!) })}
                          className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium bg-warning/15 text-warning border-warning/30"
                        >
                          {t('devices.list.agentSilent', { duration: formatSilentDuration(device.mainAgentSilentSince!) })}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-sm">
                    {device.status === 'online' ? (
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-16 overflow-hidden rounded-full bg-muted">
                          <div
                            className={`h-full rounded-full ${device.cpuPercent > 80 ? 'bg-destructive' : device.cpuPercent > 60 ? 'bg-warning' : 'bg-success'} ${widthPercentClass(device.cpuPercent)}`}
                          />
                        </div>
                        <span className="w-10 text-right tabular-nums">{device.cpuPercent}%</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">&mdash;</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-sm">
                    {device.status === 'online' ? (
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-16 overflow-hidden rounded-full bg-muted">
                          <div
                            className={`h-full rounded-full ${device.ramPercent > 80 ? 'bg-destructive' : device.ramPercent > 60 ? 'bg-warning' : 'bg-success'} ${widthPercentClass(device.ramPercent)}`}
                          />
                        </div>
                        <span className="w-10 text-right tabular-nums">{device.ramPercent}%</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">&mdash;</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-sm text-muted-foreground whitespace-nowrap">
                    {formatLastSeen(device.lastSeen, effectiveTimezone)}
                  </td>
                  <td className="px-3 py-3 text-sm" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <ConnectDesktopButton
                        deviceId={device.id}
                        iconOnly
                        disabled={device.status !== 'online'}
                        isHeadless={device.isHeadless}
                        desktopAccess={device.desktopAccess}
                        remoteAccessPolicy={device.remoteAccessPolicy}
                      />
                      <div className="relative" ref={rowMenuOpenId === device.id ? rowMenuRef : undefined}>
                        <button
                          type="button"
                          onClick={(e) => {
                            if (rowMenuOpenId !== device.id) {
                              const rect = e.currentTarget.getBoundingClientRect();
                              // ~280px dropdown height (7 items × ~36px + padding/divider).
                              // Flip up when the space below the button is less than that.
                              setRowMenuFlipUp(window.innerHeight - rect.bottom < 300);
                            }
                            setRowMenuOpenId(rowMenuOpenId === device.id ? null : device.id);
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-md transition hover:bg-muted"
                          aria-label={t('devices.list.rowActions')}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                        {rowMenuOpenId === device.id && (
                          <div className={`absolute right-0 z-50 w-48 rounded-md border bg-card shadow-lg ${rowMenuFlipUp ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
                            <button
                              type="button"
                              disabled={device.status !== 'online'}
                              onClick={() => {
                                onAction?.('terminal', device);
                                setRowMenuOpenId(null);
                              }}
                              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Terminal className="h-4 w-4" />
                              {t('devices.list.remoteTerminal')}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                onAction?.('run-script', device);
                                setRowMenuOpenId(null);
                              }}
                              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-muted"
                            >
                              <FileCode className="h-4 w-4" />
                              {t('devices.list.runScript')}
                            </button>
                            <button
                              type="button"
                              disabled={device.status !== 'online'}
                              onClick={() => {
                                onAction?.('reboot', device);
                                setRowMenuOpenId(null);
                              }}
                              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <RotateCcw className="h-4 w-4" />
                              {t('devices.list.reboot')}
                            </button>
                            {device.status === 'offline' && (
                              <button
                                type="button"
                                onClick={() => {
                                  onAction?.('wake', device);
                                  setRowMenuOpenId(null);
                                }}
                                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-muted"
                                title={t('devices.list.wakeTitle')}
                              >
                                <Zap className="h-4 w-4" />
                                {t('devices.list.wake')}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                onAction?.('settings', device);
                                setRowMenuOpenId(null);
                              }}
                              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-muted"
                            >
                              <Settings className="h-4 w-4" />
                              {t('devices.list.settings')}
                            </button>
                            <hr className="my-1" />
                            {device.status === 'decommissioned' ? (
                              <button
                                type="button"
                                onClick={() => {
                                  onAction?.('restore', device);
                                  setRowMenuOpenId(null);
                                }}
                                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-success hover:bg-success/10"
                              >
                                <RotateCcw className="h-4 w-4" />
                                {t('devices.list.restore')}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  onAction?.('decommission', device);
                                  setRowMenuOpenId(null);
                                }}
                                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-4 w-4" />
                                {t('devices.list.decommission')}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {sortedDevices.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <p className="text-sm text-muted-foreground">
              {t('devices.list.showing', {
                from: startIndex + 1,
                to: Math.min(startIndex + effectivePageSize, sortedDevices.length),
                total: sortedDevices.length,
              })}
            </p>
            <div className="flex items-center gap-2">
              <label htmlFor="device-page-size" className="text-sm text-muted-foreground">
                {t('devices.list.perPage')}
              </label>
              <select
                id="device-page-size"
                value={effectivePageSize}
                aria-label={t('devices.list.devicesPerPage')}
                onChange={event => handlePageSizeChange(Number(event.target.value))}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring sm:w-32"
              >
                {PAGE_SIZE_OPTIONS.map(opt => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="flex h-9 w-9 items-center justify-center rounded-md border hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm">
                {t('devices.list.pageOf', { page: currentPage, total: totalPages })}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="flex h-9 w-9 items-center justify-center rounded-md border hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
