import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle,
  AlertTriangle,
  Apple,
  Package,
  ExternalLink,
  Monitor,
  Server,
  Loader2,
  RefreshCw,
  CloudDownload,
  Download,
  type LucideIcon
} from 'lucide-react';
import { fetchWithAuth } from '../../stores/auth';
import type { OSType } from './DeviceList';
import PatchInstallHistory from '../patches/PatchInstallHistory';
import { widthPercentClass } from '@/lib/utils';
import { formatDate as formatLocalizedDate, formatNumber } from '@/i18n/formatters';
import type { Locale } from '@/i18n/locales';
import { useI18n } from '@/i18n/react';
import type { TranslationParams } from '@/i18n/resources';

type PatchItem = {
  id?: string;
  name?: string;
  title?: string;
  kb?: string;
  kbNumber?: string;
  externalId?: string;
  description?: string;
  severity?: string;
  status?: string;
  category?: string;
  source?: string;
  releaseDate?: string;
  releasedAt?: string;
  installedAt?: string;
  requiresReboot?: boolean;
  isDownloaded?: boolean;
};

type PatchPayload = {
  compliancePercent?: number;
  compliance?: number;
  pending?: PatchItem[];
  pendingPatches?: PatchItem[];
  missing?: PatchItem[];
  missingPatches?: PatchItem[];
  available?: PatchItem[];
  installed?: PatchItem[];
  installedPatches?: PatchItem[];
  applied?: PatchItem[];
  patches?: PatchItem[];
};

type PatchScanResponse = {
  jobId?: string;
  queuedCommandIds?: string[];
  dispatchedCommandIds?: string[];
  pendingCommandIds?: string[];
};

type PatchInstallResponse = {
  commandId?: string;
  commandStatus?: string;
  patchCount?: number;
};

type DevicePatchStatusTabProps = {
  deviceId: string;
  timezone?: string;
  osType?: OSType;
};

type Translate = (key: string, params?: TranslationParams, fallback?: string) => string;

type BadgeDefinition = { labelKey: string; className: string };
type BadgeDisplay = { label: string; className: string };

const categoryBadges: Record<string, BadgeDefinition> = {
  system: { labelKey: 'devicePatchStatus.categories.system', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  security: { labelKey: 'devicePatchStatus.categories.security', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  application: { labelKey: 'devicePatchStatus.categories.application', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  homebrew: { labelKey: 'devicePatchStatus.categories.homebrew', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  definitions: { labelKey: 'devicePatchStatus.categories.definitions', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  driver: { labelKey: 'devicePatchStatus.categories.driver', className: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300' },
  feature: { labelKey: 'devicePatchStatus.categories.feature', className: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' }
};

const severityBadges: Record<string, BadgeDefinition> = {
  critical: { labelKey: 'devicePatchStatus.severity.critical', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  important: { labelKey: 'devicePatchStatus.severity.important', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
  high: { labelKey: 'devicePatchStatus.severity.high', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
  moderate: { labelKey: 'devicePatchStatus.severity.moderate', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  medium: { labelKey: 'devicePatchStatus.severity.medium', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  low: { labelKey: 'devicePatchStatus.severity.low', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  unknown: { labelKey: 'devicePatchStatus.severity.unknown', className: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300' }
};

const sourceBadges: Record<string, BadgeDefinition> = {
  microsoft: { labelKey: 'devicePatchStatus.sources.microsoft', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  apple: { labelKey: 'devicePatchStatus.sources.apple', className: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300' },
  linux: { labelKey: 'devicePatchStatus.sources.linux', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
  third_party: { labelKey: 'devicePatchStatus.sources.thirdParty', className: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' },
  custom: { labelKey: 'devicePatchStatus.sources.custom', className: 'bg-slate-100 text-slate-600 dark:bg-slate-900/30 dark:text-slate-400' }
};

type PatchDisplayCopy = {
  nativeIcon: LucideIcon;
  pendingNativeTitle: string;
  pendingNativeEmpty: string;
  pendingNativePrimaryColumn: string;
  pendingThirdPartyTitle: string;
  pendingThirdPartyEmpty: string;
  pendingThirdPartyPrimaryColumn: string;
  pendingThirdPartySecondaryColumn: string;
  installedNativeTitle: string;
  installedNativeEmpty: string;
  installedNativePrimaryColumn: string;
  installedThirdPartyTitle: string;
};

function getPatchDisplayCopy(osType: OSType, t: Translate): PatchDisplayCopy {
  switch (osType) {
    case 'windows':
      return {
        nativeIcon: Monitor,
        pendingNativeTitle: t('devicePatchStatus.osCopy.windows.pendingNativeTitle'),
        pendingNativeEmpty: t('devicePatchStatus.osCopy.windows.pendingNativeEmpty'),
        pendingNativePrimaryColumn: t('devicePatchStatus.columns.update'),
        pendingThirdPartyTitle: t('devicePatchStatus.osCopy.common.pendingThirdPartyTitle'),
        pendingThirdPartyEmpty: t('devicePatchStatus.osCopy.common.pendingThirdPartyEmpty'),
        pendingThirdPartyPrimaryColumn: t('devicePatchStatus.columns.software'),
        pendingThirdPartySecondaryColumn: t('devicePatchStatus.columns.category'),
        installedNativeTitle: t('devicePatchStatus.osCopy.windows.installedNativeTitle'),
        installedNativeEmpty: t('devicePatchStatus.osCopy.windows.installedNativeEmpty'),
        installedNativePrimaryColumn: t('devicePatchStatus.columns.update'),
        installedThirdPartyTitle: t('devicePatchStatus.osCopy.common.installedThirdPartyTitle')
      };
    case 'linux':
      return {
        nativeIcon: Server,
        pendingNativeTitle: t('devicePatchStatus.osCopy.linux.pendingNativeTitle'),
        pendingNativeEmpty: t('devicePatchStatus.osCopy.linux.pendingNativeEmpty'),
        pendingNativePrimaryColumn: t('devicePatchStatus.columns.package'),
        pendingThirdPartyTitle: t('devicePatchStatus.osCopy.common.pendingThirdPartyTitle'),
        pendingThirdPartyEmpty: t('devicePatchStatus.osCopy.common.pendingThirdPartyEmpty'),
        pendingThirdPartyPrimaryColumn: t('devicePatchStatus.columns.software'),
        pendingThirdPartySecondaryColumn: t('devicePatchStatus.columns.category'),
        installedNativeTitle: t('devicePatchStatus.osCopy.linux.installedNativeTitle'),
        installedNativeEmpty: t('devicePatchStatus.osCopy.linux.installedNativeEmpty'),
        installedNativePrimaryColumn: t('devicePatchStatus.columns.package'),
        installedThirdPartyTitle: t('devicePatchStatus.osCopy.common.installedThirdPartyTitle')
      };
    case 'macos':
    default:
      return {
        nativeIcon: Apple,
        pendingNativeTitle: t('devicePatchStatus.osCopy.macos.pendingNativeTitle'),
        pendingNativeEmpty: t('devicePatchStatus.osCopy.macos.pendingNativeEmpty'),
        pendingNativePrimaryColumn: t('devicePatchStatus.columns.update'),
        pendingThirdPartyTitle: t('devicePatchStatus.osCopy.macos.pendingThirdPartyTitle'),
        pendingThirdPartyEmpty: t('devicePatchStatus.osCopy.macos.pendingThirdPartyEmpty'),
        pendingThirdPartyPrimaryColumn: t('devicePatchStatus.columns.package'),
        pendingThirdPartySecondaryColumn: t('devicePatchStatus.columns.type'),
        installedNativeTitle: t('devicePatchStatus.osCopy.macos.installedNativeTitle'),
        installedNativeEmpty: t('devicePatchStatus.osCopy.macos.installedNativeEmpty'),
        installedNativePrimaryColumn: t('devicePatchStatus.columns.update'),
        installedThirdPartyTitle: t('devicePatchStatus.osCopy.common.installedThirdPartyTitle')
      };
  }
}

function getNativePatchSource(osType: OSType): 'microsoft' | 'apple' | 'linux' {
  if (osType === 'windows') return 'microsoft';
  if (osType === 'linux') return 'linux';
  return 'apple';
}

function getNativePatchProviderLabel(osType: OSType, t: Translate): string {
  if (osType === 'windows') return t('devicePatchStatus.providers.windows');
  if (osType === 'linux') return t('devicePatchStatus.providers.linux');
  return t('devicePatchStatus.providers.apple');
}

function readPatchIds(patches: PatchItem[]): string[] {
  const unique = new Set<string>();
  for (const patch of patches) {
    if (typeof patch.id === 'string' && patch.id.length > 0) {
      unique.add(patch.id);
    }
  }
  return [...unique];
}

function badgeFromDefinition(definition: BadgeDefinition, t: Translate): BadgeDisplay {
  return {
    label: t(definition.labelKey),
    className: definition.className
  };
}

function getCategoryBadge(patch: PatchItem, osType: OSType, t: Translate): BadgeDisplay | null {
  const name = (patch.name || patch.title || '').toLowerCase();
  const category = (patch.category || '').toLowerCase();

  if (category === 'homebrew-cask') {
    return badgeFromDefinition(categoryBadges.homebrew, t);
  }

  if (categoryBadges[category]) {
    return badgeFromDefinition(categoryBadges[category], t);
  }

  if (osType === 'macos') {
    if (name.startsWith('macos') || name.startsWith('mac os')) {
      return badgeFromDefinition(categoryBadges.system, t);
    }
    if (name.includes('security') || name.includes('xprotect') || name.includes('gatekeeper') || name.includes('mrt')) {
      return badgeFromDefinition(categoryBadges.security, t);
    }
  }

  if (osType === 'windows') {
    if (name.includes('security intelligence')) {
      return badgeFromDefinition(categoryBadges.definitions, t);
    }
    if (name.includes('driver')) {
      return badgeFromDefinition(categoryBadges.driver, t);
    }
    if (name.includes('security update') || name.includes('cumulative update')) {
      return badgeFromDefinition(categoryBadges.security, t);
    }
  }

  return null;
}

function isApplePatch(patch: PatchItem) {
  const source = (patch.source || '').toLowerCase();
  const category = (patch.category || '').toLowerCase();
  const name = (patch.name || patch.title || '').toLowerCase();

  if (category === 'homebrew' || category === 'homebrew-cask') {
    return false;
  }

  if (source === 'apple') {
    return true;
  }
  if (source === 'microsoft' || source === 'linux' || source === 'third_party' || source === 'custom') {
    return false;
  }

  return category === 'system' ||
    category === 'security' ||
    category === 'application' ||
    name.startsWith('macos') ||
    name.startsWith('mac os') ||
    name.includes('xprotect') ||
    name.includes('gatekeeper') ||
    name.includes('rosetta');
}

function isWindowsPatch(patch: PatchItem) {
  const source = (patch.source || '').toLowerCase();
  const category = (patch.category || '').toLowerCase();
  const name = (patch.name || patch.title || '').toLowerCase();

  if (source === 'microsoft') {
    return true;
  }
  if (source === 'apple' || source === 'linux' || source === 'third_party' || source === 'custom') {
    return false;
  }

  if (category === 'security' || category === 'definitions' || category === 'driver' || category === 'feature' || category === 'system') {
    return true;
  }

  return name.includes('windows') ||
    name.includes('cumulative update') ||
    name.includes('security intelligence update') ||
    /kb\d{4,8}/i.test(name);
}

function isLinuxPatch(patch: PatchItem) {
  const source = (patch.source || '').toLowerCase();
  const category = (patch.category || '').toLowerCase();

  if (source === 'linux') {
    return true;
  }
  if (source === 'apple' || source === 'microsoft' || source === 'third_party' || source === 'custom') {
    return false;
  }

  return category === 'system' || category === 'security';
}

function isNativePatchForOs(patch: PatchItem, osType: OSType) {
  if (osType === 'windows') return isWindowsPatch(patch);
  if (osType === 'linux') return isLinuxPatch(patch);
  return isApplePatch(patch);
}

function formatPatchDate(value: string | undefined, locale: Locale, timezone: string | undefined, fallback: string): string {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : formatLocalizedDate(date, locale, timezone ? { timeZone: timezone } : undefined);
}

function normalizePatchName(patch: PatchItem, t: Translate) {
  return patch.title || patch.name || patch.kb || patch.kbNumber || t('devicePatchStatus.placeholders.unnamedPatch');
}

function getSeverityBadge(severity: string | undefined, t: Translate): BadgeDisplay | null {
  const normalized = (severity || '').trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'unknown') return null;

  if (severityBadges[normalized]) {
    return badgeFromDefinition(severityBadges[normalized], t);
  }

  return {
    label: normalized.charAt(0).toUpperCase() + normalized.slice(1),
    className: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300'
  };
}

function getKbLabel(patch: PatchItem): string | null {
  // Check explicit kbNumber field first (agent sends this)
  const explicitKbNumber = (patch.kbNumber || '').trim();
  if (explicitKbNumber) {
    return explicitKbNumber.toUpperCase().startsWith('KB') ? explicitKbNumber.toUpperCase() : `KB${explicitKbNumber}`;
  }

  const explicitKb = (patch.kb || '').trim();
  if (explicitKb) {
    return explicitKb.toUpperCase().startsWith('KB') ? explicitKb.toUpperCase() : `KB${explicitKb}`;
  }

  // Try to extract from externalId (agent maps kbNumber to externalId)
  const extId = (patch.externalId || '').trim();
  if (extId && /^kb\d{4,8}$/i.test(extId)) {
    return extId.toUpperCase();
  }

  const name = patch.title || patch.name || '';
  const match = name.match(/kb\d{4,8}/i);
  return match ? match[0].toUpperCase() : null;
}

function getSourceBadge(patch: PatchItem, t: Translate): BadgeDisplay | null {
  const source = (patch.source || '').toLowerCase();
  const category = (patch.category || '').toLowerCase();
  const externalId = (patch.externalId || '').toLowerCase();

  // Detect winget from externalId pattern (e.g. "winget:Publisher.App:1.0")
  if (externalId.startsWith('winget:')) {
    return { label: t('devicePatchStatus.sources.winget'), className: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300' };
  }

  // Detect chocolatey from externalId
  if (externalId.startsWith('chocolatey:')) {
    return { label: t('devicePatchStatus.sources.choco'), className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' };
  }

  // Homebrew categories
  if (category === 'homebrew' || category === 'homebrew-cask') {
    return { label: t('devicePatchStatus.sources.brew'), className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' };
  }

  if (sourceBadges[source]) {
    return badgeFromDefinition(sourceBadges[source], t);
  }

  return null;
}

function getReleaseLabel(patch: PatchItem, locale: Locale, timezone: string | undefined, t: Translate): string | null {
  const value = patch.releaseDate || patch.releasedAt;
  if (!value) return null;
  const formatted = formatPatchDate(value, locale, timezone, '');
  return formatted ? t('devicePatchStatus.labels.released', { date: formatted }) : null;
}

function getInstalledVersionFromDescription(description?: string): string | null {
  if (!description) return null;
  const match = description.match(/^installed:\s*(.+)$/i);
  if (!match || !match[1]) return null;
  return match[1].trim() || null;
}

function getAvailableVersionFromExternalId(externalId?: string): string | null {
  if (!externalId) return null;
  const parts = externalId.split(':');
  if (parts.length < 3) return null;
  const candidate = parts[parts.length - 1]?.trim();
  if (!candidate || candidate === 'latest') return null;
  if (!/[0-9]/.test(candidate)) return null;
  return candidate;
}

function getHomebrewPendingDetails(patch: PatchItem, osType: OSType, t: Translate) {
  if (osType !== 'macos') return null;

  const category = (patch.category || '').toLowerCase();
  const source = (patch.source || '').toLowerCase();
  const installedVersion = getInstalledVersionFromDescription(patch.description);
  const availableVersion = getAvailableVersionFromExternalId(patch.externalId);
  const brewLike = category === 'homebrew' ||
    category === 'homebrew-cask' ||
    source === 'third_party' ||
    !!installedVersion;

  if (!brewLike) return null;

  const packageType = category === 'homebrew-cask'
    ? t('devicePatchStatus.packageTypes.cask')
    : category === 'homebrew'
      ? t('devicePatchStatus.packageTypes.formula')
      : t('devicePatchStatus.packageTypes.homebrew');

  const versionLabel = installedVersion && availableVersion
    ? t('devicePatchStatus.labels.installedToAvailable', { installed: installedVersion, available: availableVersion })
    : installedVersion
      ? t('devicePatchStatus.labels.installedVersion', { version: installedVersion })
      : availableVersion
        ? t('devicePatchStatus.labels.availableVersion', { version: availableVersion })
        : null;

  return { packageType, versionLabel };
}

function getHomebrewUrl(patch: PatchItem, osType: OSType): string | null {
  const category = (patch.category || '').toLowerCase();
  const source = (patch.source || '').toLowerCase();
  const brewLikeCategory = category === 'homebrew' || category === 'homebrew-cask';
  const brewLikeSource = osType === 'macos' && source === 'third_party';

  if (!brewLikeCategory && !brewLikeSource) {
    return null;
  }

  const name = patch.name || patch.title || '';
  if (!name) return null;

  // Handle tap packages like "mongodb/brew/mongodb-community@7.0"
  // Extract just the package name after the last slash
  const packageName = name.includes('/') ? name.split('/').pop() : name;
  if (!packageName) return null;

  // Remove version suffix like "@7.0" for the URL
  const baseName = packageName.split('@')[0];

  const baseUrl = category === 'homebrew-cask'
    ? 'https://formulae.brew.sh/cask/'
    : 'https://formulae.brew.sh/formula/';

  return `${baseUrl}${baseName}`;
}

// ---------------------------------------------------------------------------
// Poll interval / duration constants for post-install auto-refresh
// macOS softwareupdate installs can take 30+ minutes to download + install,
// and the post-install rescan adds another 60s. The frontend polls for the
// full duration since the backend uses fire-and-forget command queuing.
// ---------------------------------------------------------------------------
const INSTALL_POLL_INTERVAL_MS = 5_000;
const INSTALL_POLL_MAX_DURATION_MS = 1_800_000;

export default function DevicePatchStatusTab({ deviceId, timezone, osType }: DevicePatchStatusTabProps) {
  const { locale, t } = useI18n();
  const tRef = useRef(t);
  const [payload, setPayload] = useState<PatchPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [siteTimezone, setSiteTimezone] = useState<string | undefined>(timezone);
  const [controlAction, setControlAction] = useState<
    'install-native' | 'scan-native' | 'scan-third-party' | 'install-third-party' | null
  >(null);
  const [controlNotice, setControlNotice] = useState<{ kind: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Track per-patch install in progress: patchId -> true
  const [installingPatchIds, setInstallingPatchIds] = useState<Set<string>>(new Set());

  // Track polling state after install
  const [isPolling, setIsPolling] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartRef = useRef<number>(0);
  const priorPendingCountRef = useRef<number>(-1);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  // Use provided timezone, fetched siteTimezone, or browser default
  const effectiveTimezone = timezone ?? siteTimezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

  const fetchPatchStatus = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }
      setError(undefined);
    try {
      const response = await fetchWithAuth(`/devices/${deviceId}/patches`);
      if (!response.ok) throw new Error(tRef.current('devicePatchStatus.errors.fetch'));
      const json = await response.json();
      const data = json?.data ?? json;
      setPayload(data);
      if (json?.timezone || json?.siteTimezone) {
        setSiteTimezone(json.timezone ?? json.siteTimezone);
      }
      return data as PatchPayload;
    } catch (err) {
      if (!silent) {
        setError(err instanceof Error ? err.message : tRef.current('devicePatchStatus.errors.fetch'));
      }
      return null;
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [deviceId]);

  useEffect(() => {
    fetchPatchStatus();
  }, [fetchPatchStatus, locale]);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, []);

  const normalizedOsType: OSType = osType ?? 'macos';
  const displayCopy = useMemo(() => getPatchDisplayCopy(normalizedOsType, t), [normalizedOsType, t]);
  const NativeIcon = displayCopy.nativeIcon;
  const nativeSource = useMemo(() => getNativePatchSource(normalizedOsType), [normalizedOsType]);
  const nativeProviderLabel = useMemo(() => getNativePatchProviderLabel(normalizedOsType, t), [normalizedOsType, t]);

  const { pendingNative, pendingOther, installedNative, installedThirdParty, compliancePercent, missingCount } = useMemo(() => {
    const data = payload ?? {};
    const pendingList = data.pending ?? data.pendingPatches ?? data.available ?? [];
    const missingList = data.missing ?? data.missingPatches ?? [];
    const installedList = data.installed ?? data.installedPatches ?? data.applied ?? [];
    const patches = data.patches ?? [];

    const inferredPending = pendingList.length > 0
      ? pendingList
      : patches.filter(patch => (patch.status || '').toLowerCase() === 'pending' || (patch.status || '').toLowerCase() === 'available');
    const inferredMissing = missingList.length > 0
      ? missingList
      : patches.filter(patch => (patch.status || '').toLowerCase() === 'missing');
    const inferredInstalled = installedList.length > 0
      ? installedList
      : patches.filter(patch => (patch.status || '').toLowerCase() === 'installed');

    const nativePending = inferredPending.filter(patch => isNativePatchForOs(patch, normalizedOsType));
    const otherPending = inferredPending.filter(patch => !isNativePatchForOs(patch, normalizedOsType));

    const nativeInstalled = inferredInstalled.filter(patch => isNativePatchForOs(patch, normalizedOsType));
    const thirdPartyInstalled = inferredInstalled.filter(patch => !isNativePatchForOs(patch, normalizedOsType));

    const total = inferredPending.length + inferredInstalled.length;
    const compliance = data.compliancePercent ?? data.compliance ?? (total > 0 ? Math.round((inferredInstalled.length / total) * 100) : 100);

    return {
      pendingNative: nativePending,
      pendingOther: otherPending,
      installedNative: nativeInstalled,
      installedThirdParty: thirdPartyInstalled,
      compliancePercent: compliance,
      missingCount: inferredMissing.length
    };
  }, [payload, normalizedOsType]);

  const nativePendingIds = useMemo(() => readPatchIds(pendingNative), [pendingNative]);
  const thirdPartyPendingIds = useMemo(() => readPatchIds(pendingOther), [pendingOther]);

  // -------------------------------------------------------------------------
  // Post-install polling: poll every 5s for up to 90s watching pending count
  // -------------------------------------------------------------------------
  const startInstallPolling = useCallback((initialPendingCount: number) => {
    // Stop any existing poll
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
    }

    priorPendingCountRef.current = initialPendingCount;
    pollStartRef.current = Date.now();
    setIsPolling(true);
    setControlNotice({ kind: 'info', message: tRef.current('devicePatchStatus.notices.polling') });

    pollTimerRef.current = setInterval(async () => {
      const elapsed = Date.now() - pollStartRef.current;
      if (elapsed >= INSTALL_POLL_MAX_DURATION_MS) {
        // Timeout -- stop polling
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
        setIsPolling(false);
        setInstallingPatchIds(new Set());
        setControlNotice({ kind: 'info', message: tRef.current('devicePatchStatus.notices.installTimeout') });
        await fetchPatchStatus(true);
        return;
      }

      const freshData = await fetchPatchStatus(true);
      if (!freshData) return;

      const freshPending = freshData.pending ?? freshData.pendingPatches ?? freshData.available ?? [];
      const currentPendingCount = freshPending.length;

      if (currentPendingCount < priorPendingCountRef.current) {
        // Pending count went down -- install completed (at least partially)
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
        setIsPolling(false);
        setInstallingPatchIds(new Set());
        const installed = priorPendingCountRef.current - currentPendingCount;
        setControlNotice({
          kind: 'success',
          message: tRef.current('devicePatchStatus.notices.installedCount', {
            installed: formatNumber(installed, locale),
            pending: formatNumber(currentPendingCount, locale),
          })
        });
      }
    }, INSTALL_POLL_INTERVAL_MS);
  }, [fetchPatchStatus]);

  const queuePatchScan = useCallback(async (
    action: 'scan-native' | 'scan-third-party',
    source: string,
    label: string
  ) => {
    setControlAction(action);
    setControlNotice(null);
    try {
      const response = await fetchWithAuth('/patches/scan', {
        method: 'POST',
        body: JSON.stringify({
          deviceIds: [deviceId],
          source
        })
      });
      const body = await response.json().catch(() => ({})) as PatchScanResponse & { error?: string };
      if (!response.ok) {
        throw new Error(body.error || tRef.current('devicePatchStatus.errors.queueFailed', { label }));
      }

      const queuedCount = Array.isArray(body.queuedCommandIds) ? body.queuedCommandIds.length : 0;
      const dispatchedCount = Array.isArray(body.dispatchedCommandIds) ? body.dispatchedCommandIds.length : 0;
      const jobSuffix = body.jobId ? tRef.current('devicePatchStatus.notices.jobSuffix', { jobId: body.jobId }) : '';
      const commandSuffix = queuedCount > 0
        ? tRef.current('devicePatchStatus.notices.commandQueuedSuffix', { count: formatNumber(queuedCount, locale) })
        : '';
      const dispatchSuffix = dispatchedCount > 0
        ? tRef.current('devicePatchStatus.notices.dispatchedSuffix', { count: formatNumber(dispatchedCount, locale) })
        : '';
      setControlNotice({
        kind: 'success',
        message: tRef.current('devicePatchStatus.notices.scanQueued', { label, commandSuffix, dispatchSuffix, jobSuffix })
      });
    } catch (err) {
      setControlNotice({
        kind: 'error',
        message: err instanceof Error ? err.message : tRef.current('devicePatchStatus.errors.queueFailed', { label })
      });
    } finally {
      setControlAction(null);
    }
  }, [deviceId, locale]);

  const queuePatchInstall = useCallback(async (
    action: 'install-native' | 'install-third-party',
    patchIds: string[],
    label: string
  ) => {
    if (patchIds.length === 0) {
      setControlNotice({
        kind: 'error',
        message: tRef.current('devicePatchStatus.errors.noPending', { label })
      });
      return;
    }

    const currentPendingCount = pendingNative.length + pendingOther.length;
    setControlAction(action);
    setControlNotice(null);
    try {
      const response = await fetchWithAuth(`/devices/${deviceId}/patches/install`, {
        method: 'POST',
        body: JSON.stringify({ patchIds })
      });
      const body = await response.json().catch(() => ({})) as PatchInstallResponse & { error?: string };
      if (!response.ok) {
        throw new Error(body.error || tRef.current('devicePatchStatus.errors.queueFailed', { label }));
      }

      const commandSuffix = body.commandId ? tRef.current('devicePatchStatus.notices.commandSuffix', { commandId: body.commandId }) : '';
      const patchCount = typeof body.patchCount === 'number' ? body.patchCount : patchIds.length;
      const dispatchSuffix = body.commandStatus === 'sent' ? tRef.current('devicePatchStatus.notices.andDispatchedNow') : '';
      setControlNotice({
        kind: 'success',
        message: tRef.current('devicePatchStatus.notices.installQueued', {
          label,
          count: formatNumber(patchCount, locale),
          commandSuffix,
          dispatchSuffix,
        })
      });

      // Start polling for completion
      startInstallPolling(currentPendingCount);
    } catch (err) {
      setControlNotice({
        kind: 'error',
        message: err instanceof Error ? err.message : tRef.current('devicePatchStatus.errors.queueFailed', { label })
      });
    } finally {
      setControlAction(null);
    }
  }, [deviceId, locale, pendingNative.length, pendingOther.length, startInstallPolling]);

  // Single-patch install handler
  const queueSinglePatchInstall = useCallback(async (patchId: string, patchName: string) => {
    if (!patchId) return;

    const currentPendingCount = pendingNative.length + pendingOther.length;
    setInstallingPatchIds(prev => new Set(prev).add(patchId));
    setControlNotice(null);
    try {
      const response = await fetchWithAuth(`/devices/${deviceId}/patches/install`, {
        method: 'POST',
        body: JSON.stringify({ patchIds: [patchId] })
      });
      const body = await response.json().catch(() => ({})) as PatchInstallResponse & { error?: string };
      if (!response.ok) {
        throw new Error(body.error || tRef.current('devicePatchStatus.errors.installPatch', { patchName }));
      }

      const dispatchSuffix = body.commandStatus === 'sent' ? tRef.current('devicePatchStatus.notices.andDispatched') : '';
      setControlNotice({
        kind: 'success',
        message: tRef.current('devicePatchStatus.notices.singleInstallQueued', { patchName, dispatchSuffix })
      });

      // Start polling for completion
      startInstallPolling(currentPendingCount);
    } catch (err) {
      setInstallingPatchIds(prev => {
        const next = new Set(prev);
        next.delete(patchId);
        return next;
      });
      setControlNotice({
        kind: 'error',
        message: err instanceof Error ? err.message : tRef.current('devicePatchStatus.errors.installPatch', { patchName })
      });
    }
  }, [deviceId, pendingNative.length, pendingOther.length, startInstallPolling]);

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-lg border bg-card py-12 shadow-sm">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="mt-3 text-sm text-muted-foreground">{t('devicePatchStatus.loading')}</p>
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
          onClick={() => fetchPatchStatus()}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          {t('devicePatchStatus.actions.retry')}
        </button>
      </div>
    );
  }

  const isBusy = controlAction !== null || isPolling;

  return (
    <div className="space-y-6">
      {/* ================================================================ */}
      {/* Patch Controls                                                   */}
      {/* ================================================================ */}
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold">{t('devicePatchStatus.controls.title')}</h3>
            <p className="text-sm text-muted-foreground">{t('devicePatchStatus.controls.description')}</p>
          </div>
          <button
            type="button"
            onClick={() => fetchPatchStatus()}
            disabled={isBusy}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isPolling ? 'animate-spin' : ''}`} />
            {isPolling ? t('devicePatchStatus.actions.polling') : t('devicePatchStatus.actions.refresh')}
          </button>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => queuePatchInstall('install-native', nativePendingIds, t('devicePatchStatus.actionLabels.installNative', { provider: nativeProviderLabel }))}
            disabled={isBusy || nativePendingIds.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            {controlAction === 'install-native' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4 text-green-500" />}
            {t('devicePatchStatus.actions.installOs', { count: formatNumber(nativePendingIds.length, locale) })}
          </button>

          <button
            type="button"
            onClick={() => queuePatchScan('scan-native', nativeSource, t('devicePatchStatus.actionLabels.scanNative', { provider: nativeProviderLabel }))}
            disabled={isBusy}
            className="inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            {controlAction === 'scan-native' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4 text-muted-foreground" />}
            {t('devicePatchStatus.actions.scanOs')}
          </button>

          <button
            type="button"
            onClick={() => queuePatchScan('scan-third-party', 'third_party', t('devicePatchStatus.actionLabels.scanThirdParty'))}
            disabled={isBusy}
            className="inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            {controlAction === 'scan-third-party' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4 text-muted-foreground" />}
            {t('devicePatchStatus.actions.scanThirdParty')}
          </button>

          <button
            type="button"
            onClick={() => queuePatchInstall('install-third-party', thirdPartyPendingIds, t('devicePatchStatus.actionLabels.installThirdParty'))}
            disabled={isBusy || thirdPartyPendingIds.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            {controlAction === 'install-third-party' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4 text-blue-500" />}
            {t('devicePatchStatus.actions.installThirdParty', { count: formatNumber(thirdPartyPendingIds.length, locale) })}
          </button>
        </div>

        {controlNotice && (
          <div className={`mt-4 rounded-md border px-3 py-2 text-sm ${
            controlNotice.kind === 'success'
              ? 'border-green-400/50 bg-green-500/10 text-green-700 dark:text-green-400'
              : controlNotice.kind === 'info'
                ? 'border-blue-400/50 bg-blue-500/10 text-blue-700 dark:text-blue-400'
                : 'border-destructive/40 bg-destructive/10 text-destructive'
          }`}>
            <span className="inline-flex items-center gap-1.5">
              {isPolling && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {controlNotice.message}
            </span>
          </div>
        )}

        {missingCount > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            {t('devicePatchStatus.notices.missingExcluded', { count: formatNumber(missingCount, locale) })}
          </p>
        )}
      </div>

      {/* ================================================================ */}
      {/* Patch Compliance                                                 */}
      {/* ================================================================ */}
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold">{t('devicePatchStatus.compliance.title')}</h3>
            <p className="text-sm text-muted-foreground">{t('devicePatchStatus.compliance.description')}</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle className="h-4 w-4 text-green-500" />
            {t('devicePatchStatus.compliance.percent', { percent: formatNumber(compliancePercent, locale) })}
          </div>
        </div>
        <div className="mt-4">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className={`h-full rounded-full bg-primary ${widthPercentClass(compliancePercent)}`} />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>{t('devicePatchStatus.compliance.pending', { count: formatNumber(pendingNative.length + pendingOther.length, locale) })}</span>
            <span>{t('devicePatchStatus.compliance.installed', { count: formatNumber(installedNative.length + installedThirdParty.length, locale) })}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ============================================================== */}
        {/* Pending Native OS Updates                                       */}
        {/* ============================================================== */}
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <NativeIcon className="h-4 w-4 text-gray-600" />
            <h3 className="text-sm font-semibold">{displayCopy.pendingNativeTitle}</h3>
            {pendingNative.length > 0 && (
              <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
                {formatNumber(pendingNative.length, locale)}
              </span>
            )}
          </div>
          <div className="mt-4 overflow-hidden rounded-md border">
            <div className="max-h-64 overflow-y-auto">
              <table className="min-w-full divide-y">
                <thead className="bg-muted/40 sticky top-0">
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">{displayCopy.pendingNativePrimaryColumn}</th>
                    {normalizedOsType === 'windows' && <th className="px-4 py-3">{t('devicePatchStatus.columns.kb')}</th>}
                    <th className="px-4 py-3">{t('devicePatchStatus.columns.source')}</th>
                    <th className="px-4 py-3">{t('devicePatchStatus.columns.category')}</th>
                    <th className="w-16 px-2 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {pendingNative.length === 0 ? (
                    <tr>
                      <td colSpan={normalizedOsType === 'windows' ? 5 : 4} className="px-4 py-6 text-center text-sm text-muted-foreground">
                        {displayCopy.pendingNativeEmpty}
                      </td>
                    </tr>
                  ) : (
                    pendingNative.map((patch, index) => {
                      const badge = getCategoryBadge(patch, normalizedOsType, t);
                      const severityBadge = getSeverityBadge(patch.severity, t);
                      const kbLabel = getKbLabel(patch);
                      const releaseLabel = getReleaseLabel(patch, locale, effectiveTimezone, t);
                      const srcBadge = getSourceBadge(patch, t);
                      const patchId = patch.id;
                      const isInstalling = patchId ? installingPatchIds.has(patchId) : false;
                      const notDownloaded = patch.isDownloaded === false;
                      const patchName = normalizePatchName(patch, t);
                      return (
                        <tr key={patch.id ?? `${patch.name ?? patch.title ?? 'pending-native'}-${index}`} className="text-sm">
                          <td className="px-4 py-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <p className="font-medium">{patchName}</p>
                                {notDownloaded && (
                                  <span title={t('devicePatchStatus.tooltips.notDownloaded')} className="inline-flex items-center text-muted-foreground">
                                    <CloudDownload className="h-3.5 w-3.5" />
                                  </span>
                                )}
                              </div>
                              {(severityBadge || (normalizedOsType !== 'windows' && kbLabel) || releaseLabel || patch.requiresReboot) && (
                                <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                                  {severityBadge && (
                                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${severityBadge.className}`}>
                                      {severityBadge.label}
                                    </span>
                                  )}
                                  {/* Show KB inline badge only when there is no dedicated KB column */}
                                  {normalizedOsType !== 'windows' && kbLabel && (
                                    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-wide text-muted-foreground">
                                      {kbLabel}
                                    </span>
                                  )}
                                  {releaseLabel && <span>{releaseLabel}</span>}
                                  {patch.requiresReboot && (
                                    <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-[11px] font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200">
                                      {t('devicePatchStatus.labels.rebootRequired')}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                          {normalizedOsType === 'windows' && (
                            <td className="px-4 py-3">
                              {kbLabel ? (
                                <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-wide text-muted-foreground">
                                  {kbLabel}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">--</span>
                              )}
                            </td>
                          )}
                          <td className="px-4 py-3">
                            {srcBadge ? (
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${srcBadge.className}`}>
                                {srcBadge.label}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">--</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {badge ? (
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>
                                {badge.label}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground capitalize">
                                {patch.category || t('devicePatchStatus.placeholders.uncategorized')}
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-3">
                            {patchId && (
                              <button
                                type="button"
                                title={t('devicePatchStatus.actions.installPatch', { name: patchName })}
                                disabled={isBusy || isInstalling}
                                onClick={() => queueSinglePatchInstall(patchId, patchName)}
                                className="inline-flex items-center justify-center rounded-md border p-1.5 text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {isInstalling ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
                                ) : (
                                  <Download className="h-3.5 w-3.5 text-green-600" />
                                )}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* Pending Third-Party Updates                                     */}
        {/* ============================================================== */}
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            <h3 className="text-sm font-semibold">{displayCopy.pendingThirdPartyTitle}</h3>
            {pendingOther.length > 0 && (
              <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
                {formatNumber(pendingOther.length, locale)}
              </span>
            )}
          </div>
          <div className="mt-4 overflow-hidden rounded-md border">
            <div className="max-h-64 overflow-y-auto">
              <table className="min-w-full divide-y">
                <thead className="bg-muted/40 sticky top-0">
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">{displayCopy.pendingThirdPartyPrimaryColumn}</th>
                    <th className="px-4 py-3">{t('devicePatchStatus.columns.source')}</th>
                    <th className="px-4 py-3">{displayCopy.pendingThirdPartySecondaryColumn}</th>
                    <th className="w-16 px-2 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {pendingOther.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-sm text-muted-foreground">
                        {displayCopy.pendingThirdPartyEmpty}
                      </td>
                    </tr>
                  ) : (
                    pendingOther.map((patch, index) => {
                      const badge = getCategoryBadge(patch, normalizedOsType, t);
                      const brewUrl = normalizedOsType === 'macos' ? getHomebrewUrl(patch, normalizedOsType) : null;
                      const brewDetails = getHomebrewPendingDetails(patch, normalizedOsType, t);
                      const severityBadge = getSeverityBadge(patch.severity, t);
                      const kbLabel = getKbLabel(patch);
                      const releaseLabel = getReleaseLabel(patch, locale, effectiveTimezone, t);
                      const srcBadge = getSourceBadge(patch, t);
                      const patchId = patch.id;
                      const isInstalling = patchId ? installingPatchIds.has(patchId) : false;
                      const notDownloaded = patch.isDownloaded === false;
                      const patchName = normalizePatchName(patch, t);
                      return (
                        <tr key={patch.id ?? `${patch.name ?? patch.title ?? 'pending-other'}-${index}`} className="text-sm">
                          <td className="px-4 py-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <div className="font-medium">
                                  {brewUrl ? (
                                    <a
                                      href={brewUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
                                    >
                                      {patchName}
                                      <ExternalLink className="h-3 w-3" />
                                    </a>
                                  ) : (
                                    patchName
                                  )}
                                </div>
                                {notDownloaded && (
                                  <span title={t('devicePatchStatus.tooltips.notDownloaded')} className="inline-flex items-center text-muted-foreground">
                                    <CloudDownload className="h-3.5 w-3.5" />
                                  </span>
                                )}
                              </div>
                              {(severityBadge || kbLabel || releaseLabel || patch.requiresReboot) && (
                                <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                                  {severityBadge && (
                                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${severityBadge.className}`}>
                                      {severityBadge.label}
                                    </span>
                                  )}
                                  {kbLabel && (
                                    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-wide text-muted-foreground">
                                      {kbLabel}
                                    </span>
                                  )}
                                  {releaseLabel && <span>{releaseLabel}</span>}
                                  {patch.requiresReboot && (
                                    <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-[11px] font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200">
                                      {t('devicePatchStatus.labels.rebootRequired')}
                                    </span>
                                  )}
                                </div>
                              )}
                              {brewDetails?.versionLabel && (
                                <div className="text-xs text-muted-foreground">
                                  {brewDetails.versionLabel}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {srcBadge ? (
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${srcBadge.className}`}>
                                {srcBadge.label}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">--</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {brewDetails ? (
                              <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                                {brewDetails.packageType}
                              </span>
                            ) : badge ? (
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>
                                {badge.label}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground capitalize">
                                {patch.category || t('devicePatchStatus.placeholders.thirdParty')}
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-3">
                            {patchId && (
                              <button
                                type="button"
                                title={t('devicePatchStatus.actions.installPatch', { name: patchName })}
                                disabled={isBusy || isInstalling}
                                onClick={() => queueSinglePatchInstall(patchId, patchName)}
                                className="inline-flex items-center justify-center rounded-md border p-1.5 text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {isInstalling ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
                                ) : (
                                  <Download className="h-3.5 w-3.5 text-green-600" />
                                )}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* Installed Native OS Updates                                     */}
        {/* ============================================================== */}
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <NativeIcon className="h-4 w-4 text-gray-600" />
            <h3 className="text-sm font-semibold">{displayCopy.installedNativeTitle}</h3>
            <span className="text-xs text-muted-foreground">({formatNumber(installedNative.length, locale)})</span>
          </div>
          <div className="mt-4 overflow-hidden rounded-md border">
            <div className="max-h-64 overflow-y-auto">
              <table className="min-w-full divide-y">
                <thead className="bg-muted/40 sticky top-0">
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">{displayCopy.installedNativePrimaryColumn}</th>
                    {normalizedOsType === 'windows' && <th className="px-4 py-3">{t('devicePatchStatus.columns.kb')}</th>}
                    <th className="px-4 py-3">{t('devicePatchStatus.columns.category')}</th>
                    <th className="px-4 py-3">{t('devicePatchStatus.columns.installed')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {installedNative.length === 0 ? (
                    <tr>
                      <td colSpan={normalizedOsType === 'windows' ? 4 : 3} className="px-4 py-6 text-center text-sm text-muted-foreground">
                        {displayCopy.installedNativeEmpty}
                      </td>
                    </tr>
                  ) : (
                    installedNative.map((patch, index) => {
                      const badge = getCategoryBadge(patch, normalizedOsType, t);
                      const kbLabel = getKbLabel(patch);
                      const patchName = normalizePatchName(patch, t);
                      return (
                        <tr key={patch.id ?? `${patch.name ?? patch.title ?? 'apple'}-${index}`} className="text-sm">
                          <td className="px-4 py-3 font-medium">{patchName}</td>
                          {normalizedOsType === 'windows' && (
                            <td className="px-4 py-3">
                              {kbLabel ? (
                                <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-wide text-muted-foreground">
                                  {kbLabel}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">--</span>
                              )}
                            </td>
                          )}
                          <td className="px-4 py-3">
                            {badge ? (
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>
                                {badge.label}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground capitalize">
                                {patch.category || t('devicePatchStatus.placeholders.uncategorized')}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {formatPatchDate(patch.installedAt, locale, effectiveTimezone, t('devicePatchStatus.placeholders.notReported'))}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================ */}
      {/* Installed Third-Party Updates                                     */}
      {/* ================================================================ */}
      {installedThirdParty.length > 0 && (
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <Package className="h-4 w-4 text-blue-500" />
            <h3 className="text-sm font-semibold">{displayCopy.installedThirdPartyTitle}</h3>
            <span className="text-xs text-muted-foreground">({formatNumber(installedThirdParty.length, locale)})</span>
          </div>
          <div className="mt-4 overflow-hidden rounded-md border">
            <div className="max-h-64 overflow-y-auto">
              <table className="min-w-full divide-y">
                <thead className="bg-muted/40 sticky top-0">
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">{t('devicePatchStatus.columns.software')}</th>
                    <th className="px-4 py-3">{t('devicePatchStatus.columns.source')}</th>
                    <th className="px-4 py-3">{t('devicePatchStatus.columns.installed')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {installedThirdParty.map((patch, index) => {
                    const brewUrl = normalizedOsType === 'macos' ? getHomebrewUrl(patch, normalizedOsType) : null;
                    const srcBadge = getSourceBadge(patch, t);
                    const patchName = normalizePatchName(patch, t);
                    return (
                      <tr key={patch.id ?? `${patch.name ?? patch.title ?? 'thirdparty'}-${index}`} className="text-sm">
                        <td className="px-4 py-3 font-medium">
                          {brewUrl ? (
                            <a
                              href={brewUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
                            >
                              {patchName}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            patchName
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {srcBadge ? (
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${srcBadge.className}`}>
                              {srcBadge.label}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">--</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {formatPatchDate(patch.installedAt, locale, effectiveTimezone, t('devicePatchStatus.placeholders.notReported'))}
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

      <PatchInstallHistory deviceId={deviceId} />
    </div>
  );
}
