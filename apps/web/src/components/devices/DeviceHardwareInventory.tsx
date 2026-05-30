import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Cpu, HardDrive, MemoryStick, Network } from 'lucide-react';
import { fetchWithAuth } from '../../stores/auth';
import DeviceWarrantyCard from './DeviceWarrantyCard';
import { useI18n } from '@/i18n/react';
import type { TranslationParams } from '@/i18n/resources';

type DiskDrive = {
  id?: string;
  name?: string;
  model?: string;
  sizeGb?: number | string;
  sizeGB?: number | string;
  capacityGb?: number | string;
  usedGb?: number | string;
  usedGB?: number | string;
  used?: number | string;
  totalGb?: number | string;
  usedPercent?: number | string;
  percentUsed?: number | string;
  usagePercent?: number | string;
  mountPoint?: string;
  device?: string;
  health?: string;
  status?: string;
};

type NetworkAdapter = {
  id?: string;
  name?: string;
  interfaceName?: string;
  ipAddress?: string;
  ip?: string;
  macAddress?: string;
  mac?: string;
  isPrimary?: boolean;
  speedMbps?: number | string;
  status?: string;
};

type HardwareInventory = {
  cpuModel?: string | null;
  cpuCores?: number | null;
  cpuThreads?: number | null;
  ramTotalMb?: number | null;
  diskTotalGb?: number | null;
};

type HardwareInventoryResponse = HardwareInventory & {
  hardware?: HardwareInventory;
  disks?: DiskDrive[];
  diskDrives?: DiskDrive[];
  drives?: DiskDrive[];
  networkAdapters?: NetworkAdapter[];
  networkInterfaces?: NetworkAdapter[];
  adapters?: NetworkAdapter[];
};

type DeviceHardwareInventoryProps = {
  deviceId: string;
};

type Translate = (key: string, params?: TranslationParams, fallback?: string) => string;

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatGb(value: number | null | undefined, t: Translate): string {
  if (value === null || value === undefined) return t('deviceHardware.notReported');
  if (value >= 1024) return `${(value / 1024).toFixed(1)} TB`;
  return `${value.toFixed(1)} GB`;
}

function formatRam(valueMb: number | null | undefined, t: Translate): string {
  if (valueMb === null || valueMb === undefined) return t('deviceHardware.notReported');
  const gb = valueMb / 1024;
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${valueMb} MB`;
}

function getHealthBadge(health: string | undefined, status: string | undefined, t: Translate) {
  const normalized = (health || status || '').toLowerCase();
  if (['healthy', 'ok', 'good', 'normal'].includes(normalized)) {
    return { label: t('deviceHardware.health.healthy'), className: 'bg-success/15 text-success border-success/30' };
  }
  if (['warning', 'degraded'].includes(normalized)) {
    return { label: t('deviceHardware.health.warning'), className: 'bg-warning/15 text-warning border-warning/30' };
  }
  if (['critical', 'failed', 'error'].includes(normalized)) {
    return { label: t('deviceHardware.health.critical'), className: 'bg-destructive/15 text-destructive border-destructive/30' };
  }
  return { label: health || status || t('deviceHardware.health.unknown'), className: 'bg-muted/40 text-muted-foreground border-muted' };
}

export default function DeviceHardwareInventory({ deviceId }: DeviceHardwareInventoryProps) {
  const { t } = useI18n();
  const tRef = useRef(t);
  const [hardware, setHardware] = useState<HardwareInventory | null>(null);
  const [disks, setDisks] = useState<DiskDrive[]>([]);
  const [adapters, setAdapters] = useState<NetworkAdapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const fetchHardware = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const response = await fetchWithAuth(`/devices/${deviceId}/hardware`);
      if (!response.ok) throw new Error(tRef.current('deviceHardware.errors.fetch'));
      const json: HardwareInventoryResponse & { data?: HardwareInventoryResponse } = await response.json();
      const payload = json?.data ?? json;
      const normalizedHardware = payload.hardware ?? payload;
      const diskList = payload.disks ?? payload.diskDrives ?? payload.drives ?? [];
      const adapterList = payload.networkAdapters ?? payload.networkInterfaces ?? payload.adapters ?? [];

      setHardware(normalizedHardware);
      setDisks(Array.isArray(diskList) ? diskList : []);
      setAdapters(Array.isArray(adapterList) ? adapterList : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : tRef.current('deviceHardware.errors.fetch'));
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    fetchHardware();
  }, [fetchHardware]);

  const diskRows = useMemo(() => {
    return disks.map((disk, index) => {
      const sizeGb = toNumber(disk.sizeGb ?? disk.sizeGB ?? disk.totalGb ?? disk.capacityGb ?? null);
      const usedGb = toNumber(disk.usedGb ?? disk.usedGB ?? disk.used ?? null);
      const percentValue = toNumber(disk.percentUsed ?? disk.usagePercent ?? disk.usedPercent ?? null);
      const computedPercent = percentValue ?? (sizeGb && usedGb ? Math.min(100, Math.round((usedGb / sizeGb) * 100)) : null);

      return {
        key: disk.id ?? `${disk.name ?? disk.model ?? 'disk'}-${index}`,
        name: disk.name ?? disk.mountPoint ?? disk.model ?? t('deviceHardware.diskFallback', { index: index + 1 }),
        sizeLabel: formatGb(sizeGb, t),
        usedLabel: usedGb !== null ? formatGb(usedGb, t) : t('deviceHardware.notReported'),
        percentLabel: computedPercent !== null ? `${computedPercent}%` : t('deviceHardware.notReported'),
        health: getHealthBadge(disk.health, disk.status, t)
      };
    });
  }, [disks, t]);

  // Compute total storage from disks
  const totalStorageGb = useMemo(() => {
    if (!disks || disks.length === 0) return hardware?.diskTotalGb ?? null;
    const seen = new Set<string>();
    let total = 0;
    for (const disk of disks) {
      const size = toNumber(disk.totalGb ?? disk.sizeGb ?? disk.capacityGb ?? null);
      const deviceKey = disk.device ?? disk.mountPoint ?? disk.id;
      if (disk.mountPoint === '/' || disk.mountPoint === 'C:\\') {
        return size;
      }
      if (deviceKey && !seen.has(deviceKey)) {
        seen.add(deviceKey);
        total += size ?? 0;
      }
    }
    return total > 0 ? total : (hardware?.diskTotalGb ?? null);
  }, [disks, hardware?.diskTotalGb]);

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-lg border bg-card py-12 shadow-sm">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="mt-3 text-sm text-muted-foreground">{t('deviceHardware.loading')}</p>
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
          onClick={fetchHardware}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          {t('deviceHardware.retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Cpu className="h-4 w-4" />
            {t('deviceHardware.cards.cpu')}
          </div>
          <p className="mt-3 text-lg font-semibold">{hardware?.cpuModel || t('deviceHardware.notReported')}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {hardware?.cpuCores
              ? t('deviceHardware.cores', { count: hardware.cpuCores })
              : t('deviceHardware.coresNotReported')}
            {hardware?.cpuThreads ? t('deviceHardware.threads', { count: hardware.cpuThreads }) : ''}
          </p>
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MemoryStick className="h-4 w-4" />
            {t('deviceHardware.cards.memory')}
          </div>
          <p className="mt-3 text-lg font-semibold">{formatRam(hardware?.ramTotalMb, t)}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t('deviceHardware.totalRam')}</p>
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <HardDrive className="h-4 w-4" />
            {t('deviceHardware.cards.storage')}
          </div>
          <p className="mt-3 text-lg font-semibold">{formatGb(totalStorageGb, t)}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t('deviceHardware.totalDisk')}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h3 className="text-sm font-semibold">{t('deviceHardware.diskDrives')}</h3>
          <div className="mt-4 overflow-hidden rounded-md border">
            <table className="min-w-full divide-y">
              <thead className="bg-muted/40">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">{t('deviceHardware.table.drive')}</th>
                  <th className="px-4 py-3">{t('deviceHardware.table.size')}</th>
                  <th className="px-4 py-3">{t('deviceHardware.table.used')}</th>
                  <th className="px-4 py-3">{t('deviceHardware.table.health')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {diskRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-sm text-muted-foreground">
                      {t('deviceHardware.emptyDisks')}
                    </td>
                  </tr>
                ) : (
                  diskRows.map(disk => (
                    <tr key={disk.key} className="text-sm">
                      <td className="px-4 py-3 font-medium">{disk.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{disk.sizeLabel}</td>
                      <td className="px-4 py-3 text-muted-foreground">{disk.usedLabel}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${disk.health.className}`}>
                          {disk.health.label}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h3 className="text-sm font-semibold">{t('deviceHardware.networkAdapters')}</h3>
          <div className="mt-4 space-y-3">
            {adapters.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('deviceHardware.emptyAdapters')}</p>
            ) : (
              adapters.map((adapter, index) => {
                const name = adapter.name ?? adapter.interfaceName ?? t('deviceHardware.adapterFallback', { index: index + 1 });
                const ip = adapter.ipAddress ?? adapter.ip ?? t('deviceHardware.notReported');
                const mac = adapter.macAddress ?? adapter.mac ?? t('deviceHardware.notReported');
                const speed = adapter.speedMbps
                  ? t('deviceHardware.speed', { value: adapter.speedMbps })
                  : t('deviceHardware.speedNotReported');
                return (
                  <div key={adapter.id ?? `${name}-${index}`} className="rounded-md border p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Network className="h-4 w-4 text-muted-foreground" />
                        {name}
                      </div>
                      {adapter.isPrimary && (
                        <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          {t('deviceHardware.primary')}
                        </span>
                      )}
                    </div>
                    <dl className="mt-3 space-y-1 text-xs text-muted-foreground">
                      <div className="flex justify-between">
                        <dt>{t('deviceHardware.ipAddress')}</dt>
                        <dd className="font-mono">{ip}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt>{t('deviceHardware.macAddress')}</dt>
                        <dd className="font-mono">{mac}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt>{t('deviceHardware.linkSpeed')}</dt>
                        <dd>{speed}</dd>
                      </div>
                    </dl>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <DeviceWarrantyCard deviceId={deviceId} />
    </div>
  );
}
