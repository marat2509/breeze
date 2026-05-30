import { useState, useEffect } from 'react';
import {
  Monitor,
  Cpu,
  Database,
  MemoryStick,
  HardDrive,
  Clock,
  AlertTriangle,
  Terminal,
  Package,
  Activity,
  FileText,
  ScrollText,
  Network,
  CheckCircle,
  Info,
  Server,
  Shield,
  User,
  Layers,
  Timer,
  Usb,
} from 'lucide-react';
import { formatUptime } from '../../lib/utils';
import { formatDate, formatRelativeTime } from '@/i18n/formatters';
import { useI18n } from '@/i18n/react';
import type { Device, DeviceStatus, OSType } from './DeviceList';
import DeviceActions from './DeviceActions';
import DeviceInfoTab from './DeviceInfoTab';
import DeviceHardwareInventory from './DeviceHardwareInventory';
import DeviceSoftwareInventory from './DeviceSoftwareInventory';
import DevicePatchStatusTab from './DevicePatchStatusTab';
import DeviceSecurityTab from './DeviceSecurityTab';
import DeviceAlertHistory from './DeviceAlertHistory';
import DeviceScriptHistory from './DeviceScriptHistory';
import DevicePerformanceGraphs from './DevicePerformanceGraphs';
import DeviceEventLogViewer from './DeviceEventLogViewer';
import DeviceLogsTab from './DeviceLogsTab';
import DeviceNetworkConnections from './DeviceNetworkConnections';
import DeviceFilesystemTab from './DeviceFilesystemTab';
import DeviceManagementTab from './DeviceManagementTab';
import DeviceEffectiveConfigTab from './DeviceEffectiveConfigTab';
import DeviceIpHistoryTab from './DeviceIpHistoryTab';
import DeviceBootPerformanceTab from './DeviceBootPerformanceTab';
import DevicePlaybookHistory from './DevicePlaybookHistory';
import DevicePeripheralsTab from './DevicePeripheralsTab';
import DeviceWarrantyCard from './DeviceWarrantyCard';
import MacOSPermissionsBanner from './MacOSPermissionsBanner';
import { navigateTo } from '@/lib/navigation';
import { OverflowTabs } from '../shared/OverflowTabs';
import DeviceBackupTab from '../backup/DeviceBackupTab';

type Tab =
  | 'overview'
  | 'details'
  | 'hardware'
  | 'software'
  | 'patches'
  | 'security'
  | 'management'
  | 'effective-config'
  | 'alerts'
  | 'scripts'
  | 'performance'
  | 'eventlog'
  | 'activities'
  | 'connections'
  | 'filesystem'
  | 'ip-history'
  | 'boot-performance'
  | 'playbooks'
  | 'peripherals'
  | 'backup';

type DeviceDetailsProps = {
  device: Device;
  timezone?: string;
  onBack?: () => void;
  onAction?: (action: string, device: Device) => void;
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

const osLabels: Record<OSType, string> = {
  windows: 'Windows',
  macos: 'macOS',
  linux: 'Linux'
};

function formatOsVersion(osVersion: string, osLabel: string): string {
  if (!osVersion) return osLabel;
  let v = osVersion;
  // Strip redundant "Microsoft Windows" prefix since osLabels already shows "Windows"
  v = v.replace(/^Microsoft Windows\s*/i, '');
  // Strip kernel name prefix (e.g. "darwin 26.3.1" → "26.3.1")
  v = v.replace(/^(darwin|linux)\s*/i, '');
  // Strip build/version numbers (e.g. "10.0.26200.7623 Build 26200.7623")
  v = v.replace(/\s*\d+\.\d+\.\d+[\d.]*\s*(Build\s*[\d.]+)?/i, '').trim();
  return v ? `${osLabel} ${v}` : osLabel;
}

function formatLastSeen(dateString: string, locale: 'en' | 'ru', timezone?: string): string {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 7) return formatRelativeTime(date, locale, now);
  return formatDate(date, locale, timezone ? { timeZone: timezone } : undefined);
}

const VALID_TABS: Tab[] = [
  'overview', 'details', 'hardware', 'software', 'patches', 'security',
  'management', 'effective-config', 'alerts', 'scripts', 'performance',
  'eventlog', 'activities', 'connections', 'filesystem', 'ip-history',
  'boot-performance', 'playbooks', 'peripherals', 'backup',
];

function getTabFromHash(): Tab {
  if (typeof window === 'undefined') return 'overview';
  const hash = window.location.hash.replace('#', '');
  if (VALID_TABS.includes(hash as Tab)) return hash as Tab;
  return 'overview';
}

export default function DeviceDetails({ device, timezone, onBack, onAction }: DeviceDetailsProps) {
  const { locale, t } = useI18n();
  const [activeTab, setActiveTab] = useState<Tab>(getTabFromHash);

  useEffect(() => {
    const onHashChange = () => setActiveTab(getTabFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const switchTab = (tab: Tab) => {
    window.location.hash = tab;
    setActiveTab(tab);
  };

  // Use provided timezone or browser default
  const effectiveTimezone = timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const osLabel = t(`devices.osNames.${device.os}`, undefined, osLabels[device.os]);

  const tabs: { id: Tab; label: string; icon: React.ReactNode; separator?: boolean; title?: string }[] = [
    // --- Summary ---
    { id: 'overview', label: t('deviceDetails.tabs.overview'), icon: <Monitor className="h-4 w-4" /> },
    { id: 'details', label: t('deviceDetails.tabs.details'), icon: <Info className="h-4 w-4" />, title: t('deviceDetails.tabTitles.details') },
    // --- Monitoring ---
    { id: 'performance', label: t('deviceDetails.tabs.performance'), icon: <Activity className="h-4 w-4" />, separator: true, title: t('deviceDetails.tabTitles.performance') },
    { id: 'alerts', label: t('deviceDetails.tabs.alerts'), icon: <AlertTriangle className="h-4 w-4" />, title: t('deviceDetails.tabTitles.alerts') },
    { id: 'eventlog', label: t('deviceDetails.tabs.eventlog'), icon: <FileText className="h-4 w-4" />, title: t('deviceDetails.tabTitles.eventlog') },
    // --- Inventory ---
    { id: 'hardware', label: t('deviceDetails.tabs.hardware'), icon: <Cpu className="h-4 w-4" />, separator: true },
    { id: 'software', label: t('deviceDetails.tabs.software'), icon: <Package className="h-4 w-4" /> },
    { id: 'patches', label: t('deviceDetails.tabs.patches'), icon: <CheckCircle className="h-4 w-4" />, title: t('deviceDetails.tabTitles.patches') },
    { id: 'peripherals', label: t('deviceDetails.tabs.peripherals'), icon: <Usb className="h-4 w-4" />, title: t('deviceDetails.tabTitles.peripherals') },
    // --- Management ---
    { id: 'scripts', label: t('deviceDetails.tabs.scripts'), icon: <Terminal className="h-4 w-4" />, separator: true, title: t('deviceDetails.tabTitles.scripts') },
    { id: 'management', label: t('deviceDetails.tabs.management'), icon: <Server className="h-4 w-4" />, title: t('deviceDetails.tabTitles.management') },
    { id: 'effective-config', label: t('deviceDetails.tabs.effectiveConfig'), icon: <Layers className="h-4 w-4" />, title: t('deviceDetails.tabTitles.effectiveConfig') },
    { id: 'security', label: t('deviceDetails.tabs.security'), icon: <Shield className="h-4 w-4" /> },
    { id: 'playbooks', label: t('deviceDetails.tabs.playbooks'), icon: <Activity className="h-4 w-4" />, title: t('deviceDetails.tabTitles.playbooks') },
    // --- History & Network ---
    { id: 'activities', label: t('deviceDetails.tabs.activities'), icon: <ScrollText className="h-4 w-4" />, separator: true, title: t('deviceDetails.tabTitles.activities') },
    { id: 'connections', label: t('deviceDetails.tabs.connections'), icon: <Network className="h-4 w-4" />, title: t('deviceDetails.tabTitles.connections') },
    { id: 'ip-history', label: t('deviceDetails.tabs.ipHistory'), icon: <Network className="h-4 w-4" />, title: t('deviceDetails.tabTitles.ipHistory') },
    { id: 'filesystem', label: t('deviceDetails.tabs.filesystem'), icon: <HardDrive className="h-4 w-4" />, title: t('deviceDetails.tabTitles.filesystem') },
    { id: 'boot-performance', label: t('deviceDetails.tabs.bootPerformance'), icon: <Timer className="h-4 w-4" />, title: t('deviceDetails.tabTitles.bootPerformance') },
    { id: 'backup', label: t('deviceDetails.tabs.backup'), icon: <Database className="h-4 w-4" />, title: t('deviceDetails.tabTitles.backup') }
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-muted">
              <Monitor className="h-7 w-7 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3 min-w-0">
                <h1 className="truncate text-xl font-semibold tracking-tight" title={device.displayName || device.hostname}>{device.displayName || device.hostname}</h1>
                <span className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-xs font-medium ${statusColors[device.status]}`}>
                  {t(`devices.status.${device.status}`, undefined, device.status)}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span>{formatOsVersion(device.osVersion, osLabel)}</span>
                <span>{t('deviceDetails.agentVersion', { version: device.agentVersion })}</span>
                <span>{device.siteName}</span>
              </div>
            </div>
          </div>
          <DeviceActions device={device} onAction={onAction} />
        </div>
      </div>

      <MacOSPermissionsBanner deviceId={device.id} osType={device.os} />

      <OverflowTabs tabs={tabs} activeTab={activeTab} onTabChange={(id) => switchTab(id as Tab)} />

      {activeTab === 'overview' && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <div className="flex flex-wrap gap-x-8 gap-y-3 rounded-lg border bg-card px-5 py-4">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Cpu className="h-3.5 w-3.5" />
                  {t('deviceDetails.overview.cpu')}
                </div>
                <p className="mt-1 text-lg font-semibold tabular-nums">{device.cpuPercent.toFixed(1)}%</p>
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <MemoryStick className="h-3.5 w-3.5" />
                  {t('deviceDetails.overview.ram')}
                </div>
                <p className="mt-1 text-lg font-semibold tabular-nums">{device.ramPercent.toFixed(1)}%</p>
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  {t('deviceDetails.overview.lastSeen')}
                </div>
                <p className="mt-1 text-lg font-semibold">{formatLastSeen(device.lastSeen, locale, effectiveTimezone)}</p>
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  {t('deviceDetails.overview.uptime')}
                </div>
                <p className="mt-1 text-lg font-semibold">{formatUptime(device.uptimeSeconds)}</p>
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <User className="h-3.5 w-3.5" />
                  {t('deviceDetails.overview.loggedInUser')}
                </div>
                <p className="mt-1 text-lg font-semibold truncate" title={device.lastUser || undefined}>{device.lastUser || '—'}</p>
              </div>
            </div>

            <DevicePerformanceGraphs deviceId={device.id} compact />

            <DeviceWarrantyCard deviceId={device.id} compact />
          </div>

          <DeviceAlertHistory deviceId={device.id} timezone={effectiveTimezone} showFilters={false} limit={4} />
        </div>
      )}

      {activeTab === 'details' && (
        <DeviceInfoTab deviceId={device.id} />
      )}

      {activeTab === 'hardware' && (
        <DeviceHardwareInventory deviceId={device.id} />
      )}

      {activeTab === 'software' && (
        <DeviceSoftwareInventory deviceId={device.id} timezone={effectiveTimezone} osType={device.os} />
      )}

      {activeTab === 'patches' && (
        <DevicePatchStatusTab deviceId={device.id} timezone={effectiveTimezone} osType={device.os} />
      )}

      {activeTab === 'filesystem' && (
        <DeviceFilesystemTab
          deviceId={device.id}
          osType={device.os}
          onOpenFiles={() => {
            if (onAction) {
              onAction('files', device);
              return;
            }
            void navigateTo(`/remote/files/${device.id}`);
          }}
        />
      )}

      {activeTab === 'security' && (
        <DeviceSecurityTab deviceId={device.id} timezone={effectiveTimezone} />
      )}

      {activeTab === 'peripherals' && (
        <DevicePeripheralsTab deviceId={device.id} timezone={effectiveTimezone} />
      )}

      {activeTab === 'management' && (
        <DeviceManagementTab deviceId={device.id} />
      )}

      {activeTab === 'effective-config' && (
        <DeviceEffectiveConfigTab deviceId={device.id} />
      )}

      {activeTab === 'alerts' && (
        <DeviceAlertHistory deviceId={device.id} timezone={effectiveTimezone} />
      )}

      {activeTab === 'scripts' && (
        <DeviceScriptHistory deviceId={device.id} timezone={effectiveTimezone} />
      )}

      {activeTab === 'performance' && (
        <DevicePerformanceGraphs deviceId={device.id} />
      )}

      {activeTab === 'boot-performance' && (
        <DeviceBootPerformanceTab deviceId={device.id} timezone={effectiveTimezone} />
      )}

      {activeTab === 'eventlog' && (
        <DeviceLogsTab deviceId={device.id} timezone={effectiveTimezone} osType={device.os} />
      )}

      {activeTab === 'activities' && (
        <DeviceEventLogViewer deviceId={device.id} timezone={effectiveTimezone} />
      )}

      {activeTab === 'connections' && (
        <DeviceNetworkConnections deviceId={device.id} />
      )}

      {activeTab === 'ip-history' && (
        <DeviceIpHistoryTab deviceId={device.id} />
      )}

      {activeTab === 'playbooks' && (
        <DevicePlaybookHistory deviceId={device.id} timezone={effectiveTimezone} />
      )}

      {activeTab === 'backup' && (
        <DeviceBackupTab
          deviceId={device.id}
          deviceStatus={device.status}
          timezone={effectiveTimezone}
        />
      )}
    </div>
  );
}
