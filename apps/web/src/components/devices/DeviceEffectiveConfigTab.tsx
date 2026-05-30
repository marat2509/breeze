import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  Bell,
  ClipboardCheck,
  HardDrive,
  Layers,
  PackageCheck,
  RefreshCw,
  Shield,
  Activity,
  Wrench,
  Zap,
} from 'lucide-react';

import { friendlyFetchError } from '../../lib/utils';
import { fetchWithAuth } from '../../stores/auth';
import { useI18n } from '@/i18n/react';
import type { TranslationParams } from '@/i18n/resources';

// ── Types ────────────────────────────────────────────────────────────

type FeatureType =
  | 'patch'
  | 'alert_rule'
  | 'backup'
  | 'security'
  | 'monitoring'
  | 'maintenance'
  | 'compliance'
  | 'automation';

type AssignmentLevel = 'partner' | 'organization' | 'site' | 'device_group' | 'device';

type ResolvedFeature = {
  featureType: FeatureType;
  featurePolicyId: string | null;
  inlineSettings: Record<string, unknown> | null;
  sourceLevel: AssignmentLevel;
  sourceTargetId: string;
  sourcePolicyId: string;
  sourcePolicyName: string;
  sourcePriority: number;
};

type InheritanceEntry = {
  level: AssignmentLevel;
  targetId: string;
  policyId: string;
  policyName: string;
  priority: number;
  featureTypes: FeatureType[];
};

type EffectiveConfiguration = {
  deviceId: string;
  features: Record<string, ResolvedFeature>;
  inheritanceChain: InheritanceEntry[];
};

// ── Constants ────────────────────────────────────────────────────────

const ALL_FEATURE_TYPES: FeatureType[] = [
  'patch',
  'alert_rule',
  'automation',
  'maintenance',
  'compliance',
  'security',
  'backup',
  'monitoring',
];

const FEATURE_ICONS: Record<FeatureType, ReactNode> = {
  patch: <PackageCheck className="h-5 w-5" />,
  alert_rule: <Bell className="h-5 w-5" />,
  automation: <Zap className="h-5 w-5" />,
  maintenance: <Wrench className="h-5 w-5" />,
  compliance: <ClipboardCheck className="h-5 w-5" />,
  security: <Shield className="h-5 w-5" />,
  backup: <HardDrive className="h-5 w-5" />,
  monitoring: <Activity className="h-5 w-5" />,
};

// ── Helpers ──────────────────────────────────────────────────────────

type Translate = (key: string, params?: TranslationParams, fallback?: string) => string;

function featureLabel(featureType: FeatureType, t: Translate): string {
  return t(`deviceEffectiveConfig.features.${featureType}`, undefined, featureType);
}

function levelLabel(level: AssignmentLevel, t: Translate): string {
  return t(`deviceEffectiveConfig.levels.${level}`, undefined, level);
}

function countLabel(count: number, singularKey: string, pluralKey: string, t: Translate): string {
  return count === 1 ? t(singularKey) : t(pluralKey);
}

function summarizeSettings(settings: Record<string, unknown> | null, t: Translate): string[] {
  if (!settings || Object.keys(settings).length === 0) return [];
  const items: string[] = [];
  for (const [key, value] of Object.entries(settings)) {
    if (value === null || value === undefined) continue;
    // Format key from camelCase/snake_case to readable
    const label = key
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .replace(/^\s/, '')
      .toLowerCase();
    if (typeof value === 'boolean') {
      items.push(t('deviceEffectiveConfig.settings.line', {
        label,
        value: value ? t('deviceEffectiveConfig.settings.yes') : t('deviceEffectiveConfig.settings.no'),
      }));
    } else if (typeof value === 'string' || typeof value === 'number') {
      items.push(t('deviceEffectiveConfig.settings.line', { label, value }));
    } else if (Array.isArray(value)) {
      items.push(t('deviceEffectiveConfig.settings.line', {
        label,
        value: t('deviceEffectiveConfig.settings.items', {
          count: value.length,
          itemLabel: countLabel(
            value.length,
            'deviceEffectiveConfig.settings.item',
            'deviceEffectiveConfig.settings.itemsPlural',
            t,
          ),
        }),
      }));
    }
    if (items.length >= 4) break; // limit to 4 summary lines
  }
  return items;
}

// ── Component ────────────────────────────────────────────────────────

type DeviceEffectiveConfigTabProps = {
  deviceId: string;
};

export default function DeviceEffectiveConfigTab({ deviceId }: DeviceEffectiveConfigTabProps) {
  const { t } = useI18n();
  const [data, setData] = useState<EffectiveConfiguration | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const fetchEffectiveConfig = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const response = await fetchWithAuth(`/configuration-policies/effective/${deviceId}`);
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      setData(await response.json());
    } catch (err) {
      setError(friendlyFetchError(err));
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    fetchEffectiveConfig();
  }, [fetchEffectiveConfig]);

  // ── Loading state ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-lg border bg-card py-12 shadow-sm">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="mt-3 text-sm text-muted-foreground">{t('deviceEffectiveConfig.loading')}</p>
        </div>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <button
          type="button"
          onClick={fetchEffectiveConfig}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          {t('deviceEffectiveConfig.retry')}
        </button>
      </div>
    );
  }

  // ── Empty state ────────────────────────────────────────────────────

  if (!data || Object.keys(data.features).length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center shadow-sm">
        <Layers className="mx-auto h-10 w-10 text-muted-foreground/50" />
        <h3 className="mt-4 font-semibold">{t('deviceEffectiveConfig.emptyTitle')}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('deviceEffectiveConfig.emptyDescription')}
        </p>
        <a
          href="/configuration-policies"
          className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          {t('deviceEffectiveConfig.emptyAction')}
        </a>
      </div>
    );
  }

  const { features, inheritanceChain } = data;
  const configuredTypes = ALL_FEATURE_TYPES.filter((ft) => features[ft]);
  const unconfiguredTypes = ALL_FEATURE_TYPES.filter((ft) => !features[ft]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{t('deviceEffectiveConfig.title')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('deviceEffectiveConfig.summary', {
              policies: inheritanceChain.length,
              policyLabel: countLabel(
                inheritanceChain.length,
                'deviceEffectiveConfig.policySingular',
                'deviceEffectiveConfig.policyPlural',
                t,
              ),
              features: configuredTypes.length,
              featureLabel: countLabel(
                configuredTypes.length,
                'deviceEffectiveConfig.featureSingular',
                'deviceEffectiveConfig.featurePlural',
                t,
              ),
            })}
          </p>
        </div>
        <button
          type="button"
          onClick={fetchEffectiveConfig}
          className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {t('deviceEffectiveConfig.refresh')}
        </button>
      </div>

      {/* Configured feature cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {configuredTypes.map((ft) => {
          const feature = features[ft]!;
          const settings = summarizeSettings(
            feature.inlineSettings as Record<string, unknown> | null,
            t,
          );

          return (
            <div key={ft} className="rounded-lg border bg-card p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  {FEATURE_ICONS[ft]}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-semibold">{featureLabel(ft, t)}</h4>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t('deviceEffectiveConfig.from')} <span className="font-medium text-foreground">{feature.sourcePolicyName}</span>
                    {' '}
                    <span className="inline-flex items-center rounded-full border bg-muted/50 px-1.5 py-0.5 text-xs text-muted-foreground">
                      {levelLabel(feature.sourceLevel, t)}
                    </span>
                  </p>
                </div>
              </div>

              {/* Settings summary */}
              {settings.length > 0 && (
                <div className="mt-3 rounded-md border bg-muted/30 px-3 py-2">
                  <ul className="space-y-0.5 text-xs text-muted-foreground">
                    {settings.map((s) => (
                      <li key={s} className="capitalize">{s}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Feature policy reference */}
              {feature.featurePolicyId && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {t('deviceEffectiveConfig.linkedPolicy')}{' '}
                  <span className="font-mono text-xs">{feature.featurePolicyId.slice(0, 8)}...</span>
                </p>
              )}
            </div>
          );
        })}

        {/* Unconfigured feature placeholders */}
        {unconfiguredTypes.map((ft) => {
          return (
            <div
              key={ft}
              className="rounded-lg border border-dashed bg-card/50 p-5 shadow-sm opacity-60"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  {FEATURE_ICONS[ft]}
                </div>
                <div>
                  <h4 className="font-semibold text-muted-foreground">{featureLabel(ft, t)}</h4>
                  <p className="mt-0.5 text-xs text-muted-foreground">{t('deviceEffectiveConfig.noPolicyAssigned')}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Inheritance chain */}
      {inheritanceChain.length > 0 && (
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h4 className="font-semibold mb-3">{t('deviceEffectiveConfig.inheritanceTitle')}</h4>
          <p className="text-xs text-muted-foreground mb-4">
            {t('deviceEffectiveConfig.inheritanceDescription')}
          </p>
          <div className="overflow-hidden rounded-md border">
            <table className="min-w-full divide-y">
              <thead className="bg-muted/40">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">{t('deviceEffectiveConfig.table.priority')}</th>
                  <th className="px-4 py-3">{t('deviceEffectiveConfig.table.level')}</th>
                  <th className="px-4 py-3">{t('deviceEffectiveConfig.table.policy')}</th>
                  <th className="px-4 py-3">{t('deviceEffectiveConfig.table.features')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {inheritanceChain.map((entry) => (
                  <tr key={`${entry.policyId}-${entry.level}-${entry.targetId}`} className="text-sm">
                    <td className="px-4 py-3 text-muted-foreground">{entry.priority}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full border bg-muted/50 px-2.5 py-1 text-xs font-medium capitalize">
                        {levelLabel(entry.level, t)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={`/configuration-policies/${entry.policyId}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {entry.policyName}
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {entry.featureTypes.map((ft) => (
                          <span
                            key={ft}
                            className="inline-flex items-center rounded-full border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground"
                          >
                            {featureLabel(ft, t)}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
