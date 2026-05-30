import { useState } from 'react';
import { X, Filter, ChevronDown, ChevronUp, Tag } from 'lucide-react';
import type { DeviceStatus, OSType } from './DeviceList';
import { DEVICE_ROLES, getDeviceRoleLabel, getDeviceRoleIcon, type DeviceRole } from '@/lib/deviceRoles';
import { useI18n } from '@/i18n/react';

type DeviceFiltersProps = {
  statusFilter: DeviceStatus[];
  osFilter: OSType[];
  roleFilter?: DeviceRole[];
  siteFilter: string | null;
  tagsFilter: string[];
  sites: { id: string; name: string }[];
  availableTags: string[];
  onStatusChange: (statuses: DeviceStatus[]) => void;
  onOsChange: (os: OSType[]) => void;
  onRoleChange?: (roles: DeviceRole[]) => void;
  onSiteChange: (siteId: string | null) => void;
  onTagsChange: (tags: string[]) => void;
  onClearAll: () => void;
  layout?: 'sidebar' | 'header';
};

const statusOptions: { value: DeviceStatus; color: string }[] = [
  { value: 'online', color: 'bg-green-500' },
  { value: 'offline', color: 'bg-red-500' },
  { value: 'maintenance', color: 'bg-yellow-500' },
  { value: 'decommissioned', color: 'bg-slate-500' },
  { value: 'updating', color: 'bg-blue-500' },
  { value: 'pending', color: 'bg-slate-400' }
];

const osOptions: OSType[] = ['windows', 'macos', 'linux'];

export default function DeviceFilters({
  statusFilter,
  osFilter,
  roleFilter = [],
  siteFilter,
  tagsFilter,
  sites,
  availableTags,
  onStatusChange,
  onOsChange,
  onRoleChange,
  onSiteChange,
  onTagsChange,
  onClearAll,
  layout = 'sidebar'
}: DeviceFiltersProps) {
  const { t } = useI18n();
  const [expandedSections, setExpandedSections] = useState({
    status: true,
    os: true,
    role: true,
    site: true,
    tags: true
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleStatusToggle = (status: DeviceStatus) => {
    if (statusFilter.includes(status)) {
      onStatusChange(statusFilter.filter(s => s !== status));
    } else {
      onStatusChange([...statusFilter, status]);
    }
  };

  const handleOsToggle = (os: OSType) => {
    if (osFilter.includes(os)) {
      onOsChange(osFilter.filter(o => o !== os));
    } else {
      onOsChange([...osFilter, os]);
    }
  };

  const handleRoleToggle = (role: DeviceRole) => {
    if (!onRoleChange) return;
    if (roleFilter.includes(role)) {
      onRoleChange(roleFilter.filter(r => r !== role));
    } else {
      onRoleChange([...roleFilter, role]);
    }
  };

  const handleTagToggle = (tag: string) => {
    if (tagsFilter.includes(tag)) {
      onTagsChange(tagsFilter.filter(t => t !== tag));
    } else {
      onTagsChange([...tagsFilter, tag]);
    }
  };

  const hasActiveFilters = statusFilter.length > 0 || osFilter.length > 0 || roleFilter.length > 0 || siteFilter !== null || tagsFilter.length > 0;
  const roleOptions: DeviceRole[] = [...DEVICE_ROLES];
  const statusLabel = (status: DeviceStatus) => t(`devices.status.${status}`, undefined, status);
  const osLabel = (os: OSType) => t(`devices.osNames.${os}`, undefined, os);
  const roleLabel = (role: DeviceRole) => t(`devices.roles.${role}`, undefined, getDeviceRoleLabel(role));

  if (layout === 'header') {
    return (
      <div className="flex flex-wrap items-center gap-3">
        {/* Status Filter Dropdown */}
        <div className="relative">
          <details className="group">
            <summary className="flex cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-muted">
              <Filter className="h-4 w-4" />
              {t('devices.filters.status')}
              {statusFilter.length > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                  {statusFilter.length}
                </span>
              )}
              <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
            </summary>
            <div className="absolute left-0 top-full z-10 mt-1 w-48 rounded-md border bg-card p-2 shadow-lg">
              {statusOptions.map(option => (
                <label key={option.value} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted">
                  <input
                    type="checkbox"
                    checked={statusFilter.includes(option.value)}
                    onChange={() => handleStatusToggle(option.value)}
                    className="h-4 w-4 rounded border-border"
                  />
                  <span className={`h-2 w-2 rounded-full ${option.color}`} />
                  <span className="text-sm">{statusLabel(option.value)}</span>
                </label>
              ))}
            </div>
          </details>
        </div>

        {/* OS Filter Dropdown */}
        <div className="relative">
          <details className="group">
            <summary className="flex cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-muted">
              {t('devices.filters.osType')}
              {osFilter.length > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                  {osFilter.length}
                </span>
              )}
              <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
            </summary>
            <div className="absolute left-0 top-full z-10 mt-1 w-48 rounded-md border bg-card p-2 shadow-lg">
              {osOptions.map(option => (
                <label key={option} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted">
                  <input
                    type="checkbox"
                    checked={osFilter.includes(option)}
                    onChange={() => handleOsToggle(option)}
                    className="h-4 w-4 rounded border-border"
                  />
                  <span className="text-sm">{osLabel(option)}</span>
                </label>
              ))}
            </div>
          </details>
        </div>

        {/* Device Role Filter Dropdown */}
        {onRoleChange && (
          <div className="relative">
            <details className="group">
              <summary className="flex cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-muted">
                {t('devices.filters.deviceRole')}
                {roleFilter.length > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                    {roleFilter.length}
                  </span>
                )}
                <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
              </summary>
              <div className="absolute left-0 top-full z-10 mt-1 max-h-64 w-48 overflow-y-auto rounded-md border bg-card p-2 shadow-lg">
                {roleOptions.map(option => {
                  const RoleIcon = getDeviceRoleIcon(option);
                  return (
                    <label key={option} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted">
                      <input
                        type="checkbox"
                        checked={roleFilter.includes(option)}
                        onChange={() => handleRoleToggle(option)}
                        className="h-4 w-4 rounded border-border"
                      />
                      <RoleIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm">{roleLabel(option)}</span>
                    </label>
                  );
                })}
              </div>
            </details>
          </div>
        )}

        {/* Site Filter Dropdown */}
        {sites.length > 0 && (
          <select
            value={siteFilter ?? ''}
            onChange={e => onSiteChange(e.target.value || null)}
            className="h-10 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">{t('devices.filters.allSites')}</option>
            {sites.map(site => (
              <option key={site.id} value={site.id}>{site.name}</option>
            ))}
          </select>
        )}

        {/* Tags Filter Dropdown */}
        {availableTags.length > 0 && (
          <div className="relative">
            <details className="group">
              <summary className="flex cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-muted">
                <Tag className="h-4 w-4" />
                {t('devices.filters.tags')}
                {tagsFilter.length > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                    {tagsFilter.length}
                  </span>
                )}
                <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
              </summary>
              <div className="absolute left-0 top-full z-10 mt-1 max-h-64 w-48 overflow-y-auto rounded-md border bg-card p-2 shadow-lg">
                {availableTags.map(tag => (
                  <label key={tag} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted">
                    <input
                      type="checkbox"
                      checked={tagsFilter.includes(tag)}
                      onChange={() => handleTagToggle(tag)}
                      className="h-4 w-4 rounded border-border"
                    />
                    <span className="text-sm">{tag}</span>
                  </label>
                ))}
              </div>
            </details>
          </div>
        )}

        {/* Clear All Button */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClearAll}
            className="flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
            {t('devices.filters.clearFilters')}
          </button>
        )}
      </div>
    );
  }

  // Sidebar layout
  return (
    <div className="w-64 rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t('devices.filters.filters')}</h3>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClearAll}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {t('devices.filters.clearAll')}
          </button>
        )}
      </div>

      {/* Status Section */}
      <div className="mt-4 border-t pt-4">
        <button
          type="button"
          onClick={() => toggleSection('status')}
          className="flex w-full items-center justify-between text-sm font-medium"
        >
          {t('devices.filters.status')}
          {expandedSections.status ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
        {expandedSections.status && (
          <div className="mt-2 space-y-2">
            {statusOptions.map(option => (
              <label key={option.value} className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={statusFilter.includes(option.value)}
                  onChange={() => handleStatusToggle(option.value)}
                  className="h-4 w-4 rounded border-border"
                />
                <span className={`h-2 w-2 rounded-full ${option.color}`} />
                <span className="text-sm">{statusLabel(option.value)}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* OS Section */}
      <div className="mt-4 border-t pt-4">
        <button
          type="button"
          onClick={() => toggleSection('os')}
          className="flex w-full items-center justify-between text-sm font-medium"
        >
          {t('devices.filters.operatingSystem')}
          {expandedSections.os ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
        {expandedSections.os && (
          <div className="mt-2 space-y-2">
            {osOptions.map(option => (
              <label key={option} className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={osFilter.includes(option)}
                  onChange={() => handleOsToggle(option)}
                  className="h-4 w-4 rounded border-border"
                />
                <span className="text-sm">{osLabel(option)}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Device Role Section */}
      {onRoleChange && (
        <div className="mt-4 border-t pt-4">
          <button
            type="button"
            onClick={() => toggleSection('role')}
            className="flex w-full items-center justify-between text-sm font-medium"
          >
            {t('devices.filters.deviceRole')}
            {expandedSections.role ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
          {expandedSections.role && (
            <div className="mt-2 max-h-48 space-y-2 overflow-y-auto">
              {roleOptions.map(option => {
                const RoleIcon = getDeviceRoleIcon(option);
                return (
                  <label key={option} className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={roleFilter.includes(option)}
                      onChange={() => handleRoleToggle(option)}
                      className="h-4 w-4 rounded border-border"
                    />
                    <RoleIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm">{roleLabel(option)}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Site Section */}
      {sites.length > 0 && (
        <div className="mt-4 border-t pt-4">
          <button
            type="button"
            onClick={() => toggleSection('site')}
            className="flex w-full items-center justify-between text-sm font-medium"
          >
            {t('devices.filters.site')}
            {expandedSections.site ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
          {expandedSections.site && (
            <div className="mt-2">
              <select
                value={siteFilter ?? ''}
                onChange={e => onSiteChange(e.target.value || null)}
                className="h-9 w-full rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">{t('devices.filters.allSites')}</option>
                {sites.map(site => (
                  <option key={site.id} value={site.id}>{site.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Tags Section */}
      {availableTags.length > 0 && (
        <div className="mt-4 border-t pt-4">
          <button
            type="button"
            onClick={() => toggleSection('tags')}
            className="flex w-full items-center justify-between text-sm font-medium"
          >
            {t('devices.filters.tags')}
            {expandedSections.tags ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
          {expandedSections.tags && (
            <div className="mt-2 max-h-48 space-y-2 overflow-y-auto">
              {availableTags.map(tag => (
                <label key={tag} className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={tagsFilter.includes(tag)}
                    onChange={() => handleTagToggle(tag)}
                    className="h-4 w-4 rounded border-border"
                  />
                  <span className="text-sm">{tag}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <div className="mt-4 border-t pt-4">
          <p className="text-xs text-muted-foreground">{t('devices.filters.activeFilters')}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {statusFilter.map(status => (
              <span
                key={status}
                className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
              >
                {statusLabel(status)}
                <button
                  type="button"
                  onClick={() => handleStatusToggle(status)}
                  aria-label={t('devices.filters.removeStatusFilter', { value: statusLabel(status) })}
                  className="hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            {osFilter.map(os => (
              <span
                key={os}
                className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
              >
                {osLabel(os)}
                <button
                  type="button"
                  onClick={() => handleOsToggle(os)}
                  aria-label={t('devices.filters.removeOsFilter', { value: osLabel(os) })}
                  className="hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            {roleFilter.map(role => (
              <span
                key={role}
                className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
              >
                {roleLabel(role)}
                <button
                  type="button"
                  onClick={() => handleRoleToggle(role)}
                  aria-label={t('devices.filters.removeRoleFilter', { value: roleLabel(role) })}
                  className="hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            {siteFilter && (
              <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
                {sites.find(s => s.id === siteFilter)?.name}
                <button
                  type="button"
                  onClick={() => onSiteChange(null)}
                  aria-label={t('devices.filters.removeSiteFilter')}
                  className="hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {tagsFilter.map(tag => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => handleTagToggle(tag)}
                  aria-label={t('devices.filters.removeTagFilter', { value: tag })}
                  className="hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
