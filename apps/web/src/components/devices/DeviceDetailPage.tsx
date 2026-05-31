import { useState, useEffect, useCallback, useRef } from 'react';
import { useEventStream } from '../../hooks/useEventStream';
import { ArrowLeft } from 'lucide-react';
import { showToast } from '../shared/Toast';
import DeviceDetails from './DeviceDetails';
import DeviceSettingsModal from './DeviceSettingsModal';
import ChangeSiteModal from './ChangeSiteModal';
import ScriptPickerModal, { type Script, type ScriptRunAsSelection } from './ScriptPickerModal';
import type { Device, DeviceStatus, OSType } from './DeviceList';
import { fetchWithAuth } from '../../stores/auth';
import { sendDeviceCommand, executeScript, toggleMaintenanceMode, decommissionDevice, clearDeviceSessions, restoreDevice, permanentDeleteDevice, sendWakeCommand, watchWakeOutcome, WakeCommandError } from '../../services/deviceActions';
import { useAiStore } from '@/stores/aiStore';
import { navigateTo } from '@/lib/navigation';
import { useI18n } from '@/i18n/react';
import type { TranslationParams } from '@/i18n/resources';
import Breadcrumbs from '../layout/Breadcrumbs';

type DeviceDetailPageProps = {
  deviceId: string;
};

type Translate = (key: string, params?: TranslationParams) => string;

function commandActionLabel(action: string, t: Translate): string {
  switch (action) {
    case 'reboot_safe_mode':
      return t('deviceDetailPage.actions.rebootSafeMode');
    case 'reboot':
      return t('deviceDetailPage.actions.reboot');
    case 'shutdown':
      return t('deviceDetailPage.actions.shutdown');
    case 'lock':
      return t('deviceDetailPage.actions.lock');
    default:
      return action;
  }
}

function wakeErrorMessage(code: string | undefined, t: Translate): string {
  switch (code) {
    case 'NO_MACS':
      return t('deviceDetailPage.wakeErrors.noMacs');
    case 'NO_SUBNET':
      return t('deviceDetailPage.wakeErrors.noSubnet');
    case 'IPV6_ONLY':
      return t('deviceDetailPage.wakeErrors.ipv6Only');
    case 'NO_RELAY':
      return t('deviceDetailPage.wakeErrors.noRelay');
    case 'RELAY_OVERRIDE_INVALID':
      return t('deviceDetailPage.wakeErrors.relayOverrideInvalid');
    case 'WS_SEND_FAILED':
      return t('deviceDetailPage.wakeErrors.wsSendFailed');
    case 'TARGET_NOT_FOUND':
      return t('deviceDetailPage.errors.notFound');
    default:
      return t('deviceDetailPage.wakeErrors.generic');
  }
}

export default function DeviceDetailPage({ deviceId }: DeviceDetailPageProps) {
  const { t } = useI18n();
  const tRef = useRef(t);
  const [device, setDevice] = useState<Device | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [actionInProgress, setActionInProgress] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [changeSiteOpen, setChangeSiteOpen] = useState(false);
  const [scriptPickerOpen, setScriptPickerOpen] = useState(false);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  // Track every in-flight wake watcher so that navigating away aborts the
  // long-running poll loop. Without this, watchWakeOutcome keeps polling
  // /devices/:id for up to 4 minutes after unmount and tries to render a
  // toast / setDevice on a dead component. (Todd's #789 review.) A Set is
  // used because a single device-detail page can only have one wake at a
  // time, but the abstraction matches the multi-target DevicesPage path
  // and is cheap.
  const wakeWatchersRef = useRef<Set<AbortController>>(new Set());
  useEffect(() => {
    const watchers = wakeWatchersRef.current;
    return () => {
      for (const ctrl of watchers) ctrl.abort();
      watchers.clear();
    };
  }, []);

  const fetchDevice = useCallback(async () => {
    try {
      setLoading(true);
      setError(undefined);

      const response = await fetchWithAuth(`/devices/${deviceId}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(tRef.current('deviceDetailPage.errors.notFound'));
        }
        throw new Error(tRef.current('deviceDetailPage.errors.fetch'));
      }

      const data = await response.json();

      // Get latest metrics from recentMetrics array
      const latestMetrics = data.recentMetrics?.[0];

      // Transform API response to match Device type
      const transformedDevice: Device = {
        id: data.id,
        hostname: data.hostname ?? data.displayName ?? tRef.current('deviceDetailPage.placeholders.unknownDevice'),
        os: (data.osType ?? data.os ?? 'windows') as OSType,
        osVersion: data.osVersion ?? '',
        status: (data.status ?? 'offline') as DeviceStatus,
        cpuPercent: latestMetrics?.cpuPercent ?? 0,
        ramPercent: latestMetrics?.ramPercent ?? 0,
        lastSeen: data.lastSeenAt ?? data.lastSeen ?? '',
        orgId: data.orgId ?? '',
        orgName: data.orgName ?? tRef.current('deviceDetailPage.placeholders.unknownOrg'),
        siteId: data.siteId ?? '',
        siteName: data.siteName ?? tRef.current('deviceDetailPage.placeholders.unknownSite'),
        agentVersion: data.agentVersion ?? '',
        tags: data.tags ?? [],
        lastUser: data.lastUser ?? undefined,
        uptimeSeconds: typeof data.uptimeSeconds === 'number' ? data.uptimeSeconds : (latestMetrics?.uptimeSeconds ?? undefined),
        deviceRole: data.deviceRole ?? undefined,
        displayName: data.displayName ?? undefined,
        isHeadless: data.isHeadless ?? undefined,
        desktopAccess: data.desktopAccess ?? undefined,
        remoteAccessPolicy: data.remoteAccessPolicy ?? undefined,
      };

      setDevice(transformedDevice);
    } catch (err) {
      const notFoundMessage = tRef.current('deviceDetailPage.errors.notFound');
      setError(err instanceof Error && err.message === notFoundMessage
        ? notFoundMessage
        : tRef.current('deviceDetailPage.errors.fetch'));
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    fetchDevice();
  }, [fetchDevice]);

  // Real-time device updates
  const handleDeviceEvent = useCallback((event: { type: string; payload: Record<string, unknown> }) => {
    const { type, payload } = event;
    const eventDeviceId = payload.deviceId as string;
    if (eventDeviceId !== deviceId) return;

    if (type === 'device.online' || type === 'device.offline') {
      setDevice(prev => prev ? {
        ...prev,
        status: (payload.status as string ?? (type === 'device.online' ? 'online' : 'offline')) as DeviceStatus,
        lastSeen: new Date().toISOString(),
        agentVersion: (payload.agentVersion as string) ?? prev.agentVersion,
      } : prev);
    } else if (type === 'device.updated') {
      const fields = payload.fields as string[] | undefined;
      if (fields?.includes('agentVersion')) {
        setDevice(prev => prev ? {
          ...prev,
          agentVersion: (payload.agentVersion as string) ?? prev.agentVersion,
        } : prev);
      }
    } else if (type === 'device.decommissioned') {
      fetchDevice();
    }
  }, [deviceId, fetchDevice]);

  const { subscribe } = useEventStream({ onEvent: handleDeviceEvent });

  useEffect(() => {
    subscribe(['device.online', 'device.offline', 'device.updated', 'device.decommissioned']);
  }, [subscribe]);

  // Inject AI context when device data is available
  const setPageContext = useAiStore((s) => s.setPageContext);
  useEffect(() => {
    if (device) {
      setPageContext({
        type: 'device',
        id: device.id,
        hostname: device.hostname,
        os: device.os,
        status: device.status,
        ip: undefined
      });
    }
    return () => setPageContext(null);
  }, [device, setPageContext]);

  const handleBack = () => {
    void navigateTo('/devices');
  };

  const handleAction = async (action: string, device: Device) => {
    if (actionInProgress) return;

    try {
      setActionInProgress(true);

      switch (action) {
        case 'reboot':
        case 'reboot_safe_mode':
        case 'shutdown':
        case 'lock': {
          await sendDeviceCommand(device.id, action);
          showToast({
            type: 'success',
            message: tRef.current('deviceDetailPage.toasts.commandSent', {
              action: commandActionLabel(action, tRef.current),
              hostname: device.hostname,
            }),
          });
          break;
        }

        case 'wake': {
          try {
            const wake = await sendWakeCommand(device.id);
            const hostname = device.hostname;
            showToast({
              type: 'success',
              message: tRef.current('deviceDetailPage.toasts.wakeSent', {
                hostname,
                relay: wake.relay.hostname,
                broadcast: wake.broadcast,
              }),
            });
            const wakeController = new AbortController();
            wakeWatchersRef.current.add(wakeController);
            void watchWakeOutcome(device.id, { signal: wakeController.signal })
              .then(async (outcome) => {
                if (outcome === 'online') {
                  showToast({
                    type: 'success',
                    message: tRef.current('deviceDetailPage.toasts.wakeOnline', { hostname }),
                  });
                  await fetchDevice();
                } else if (outcome === 'timeout') {
                  showToast({
                    type: 'error',
                    message: tRef.current('deviceDetailPage.toasts.wakeTimeout', { hostname }),
                  });
                }
                // 'aborted' is silent — user navigated away or page reloaded.
              })
              .finally(() => {
                wakeWatchersRef.current.delete(wakeController);
              });
          } catch (err) {
            if (err instanceof WakeCommandError) {
              showToast({
                type: 'error',
                message: tRef.current('deviceDetailPage.toasts.deviceError', {
                  hostname: device.hostname,
                  message: wakeErrorMessage(err.code, tRef.current),
                }),
              });
            } else {
              throw err;
            }
          }
          break;
        }

        case 'refresh': {
          await sendDeviceCommand(device.id, 'refresh_inventory');
          showToast({
            type: 'success',
            message: tRef.current('deviceDetailPage.toasts.inventoryRefresh', { hostname: device.hostname }),
          });
          break;
        }

        case 'maintenance': {
          const isCurrentlyMaintenance = device.status === 'maintenance';
          await toggleMaintenanceMode(device.id, !isCurrentlyMaintenance);
          showToast({
            type: 'success',
            message: tRef.current(
              isCurrentlyMaintenance
                ? 'deviceDetailPage.toasts.maintenanceDisabled'
                : 'deviceDetailPage.toasts.maintenanceEnabled',
              { hostname: device.hostname },
            ),
          });
          await fetchDevice();
          break;
        }

        case 'files':
          void navigateTo(`/remote/files/${device.id}`);
          return;

        case 'remote-tools':
          void navigateTo(`/remote/tools?deviceId=${device.id}&deviceName=${encodeURIComponent(device.hostname)}&os=${device.os}`);
          return;

        case 'deploy-software':
          void navigateTo('/software');
          return;

        case 'run-script':
          setScriptPickerOpen(true);
          break;

        case 'settings':
          setSettingsOpen(true);
          break;

        case 'change-site':
          setChangeSiteOpen(true);
          return;

        case 'clear-sessions': {
          const result = await clearDeviceSessions(device.id);
          showToast({
            type: 'success',
            message: tRef.current('deviceDetailPage.toasts.sessionsCleared', {
              count: String(result.cleaned),
              hostname: device.hostname,
            }),
          });
          break;
        }

        case 'decommission': {
          // Deferred execution with undo — gives the user 5 seconds to cancel
          let cancelled = false;
          showToast({
            type: 'undo',
            message: tRef.current('deviceDetailPage.toasts.decommissioning', { hostname: device.hostname }),
            duration: 5000,
            onUndo: () => {
              cancelled = true;
              showToast({
                type: 'success',
                message: tRef.current('deviceDetailPage.toasts.decommissionCancelled'),
                duration: 2000,
              });
            }
          });
          setTimeout(async () => {
            if (cancelled) return;
            try {
              await decommissionDevice(device.id);
              showToast({
                type: 'success',
                message: tRef.current('deviceDetailPage.toasts.decommissioned', { hostname: device.hostname }),
              });
              void navigateTo('/devices');
            } catch {
              showToast({
                type: 'error',
                message: tRef.current('deviceDetailPage.toasts.decommissionFailed', { hostname: device.hostname }),
              });
            }
          }, 5000);
          return;
        }

        case 'restore':
          await restoreDevice(device.id);
          showToast({
            type: 'success',
            message: tRef.current('deviceDetailPage.toasts.restored', { hostname: device.hostname }),
          });
          await fetchDevice();
          break;

        case 'permanent-delete': {
          // Deferred execution with undo — gives the user 5 seconds to cancel
          let pdCancelled = false;
          showToast({
            type: 'undo',
            message: tRef.current('deviceDetailPage.toasts.permanentDeleting', { hostname: device.hostname }),
            duration: 5000,
            onUndo: () => {
              pdCancelled = true;
              showToast({
                type: 'success',
                message: tRef.current('deviceDetailPage.toasts.permanentDeleteCancelled'),
                duration: 2000,
              });
            }
          });
          setTimeout(async () => {
            if (pdCancelled) return;
            try {
              await permanentDeleteDevice(device.id);
              showToast({
                type: 'success',
                message: tRef.current('deviceDetailPage.toasts.permanentDeleted', { hostname: device.hostname }),
              });
              void navigateTo('/devices');
            } catch {
              showToast({
                type: 'error',
                message: tRef.current('deviceDetailPage.toasts.deleteFailed', { hostname: device.hostname }),
              });
            }
          }, 5000);
          return;
        }

        default:
          showToast({
            type: 'error',
            message: tRef.current('deviceDetailPage.toasts.unknownAction', { action }),
          });
      }
    } catch {
      showToast({
        type: 'error',
        message: tRef.current('deviceDetailPage.toasts.actionFailed', {
          action,
          hostname: device.hostname,
        }),
      });
    } finally {
      setActionInProgress(false);
    }
  };

  const handleScriptSelect = async (script: Script, runAs: ScriptRunAsSelection, parameters?: Record<string, unknown>) => {
    if (actionInProgress || !device) return;

    try {
      setActionInProgress(true);
      await executeScript(script.id, [device.id], parameters, runAs);
      showToast({
        type: 'success',
        message: tRef.current('deviceDetailPage.toasts.scriptQueued', {
          script: script.name,
          hostname: device.hostname,
        }),
      });
    } catch {
      showToast({ type: 'error', message: tRef.current('deviceDetailPage.toasts.scriptQueueFailed') });
    } finally {
      setActionInProgress(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="mt-4 text-sm text-muted-foreground">{t('deviceDetailPage.loading')}</p>
        </div>
      </div>
    );
  }

  if (error || !device) {
    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={handleBack}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('deviceDetailPage.backToDevices')}
        </button>
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-center">
          <p className="text-sm text-destructive">{error || t('deviceDetailPage.errors.notFound')}</p>
          <button
            type="button"
            onClick={handleBack}
            className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            {t('deviceDetailPage.goBack')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[
        { label: t('deviceDetailPage.breadcrumbs.devices'), href: '/devices' },
        { label: device.hostname || t('deviceDetailPage.breadcrumbs.device') }
      ]} />
      <DeviceDetails device={device} onBack={handleBack} onAction={handleAction} />
      <DeviceSettingsModal
        device={device}
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaved={fetchDevice}
        onAction={handleAction}
      />
      <ChangeSiteModal
        device={device}
        isOpen={changeSiteOpen}
        onClose={() => setChangeSiteOpen(false)}
        onSaved={() => {
          showToast({
            type: 'success',
            message: tRef.current('deviceDetailPage.toasts.movedSite', { hostname: device.hostname }),
          });
          void fetchDevice();
        }}
      />
      <ScriptPickerModal
        isOpen={scriptPickerOpen}
        onClose={() => setScriptPickerOpen(false)}
        onSelect={handleScriptSelect}
        deviceHostname={device.hostname}
        deviceOs={device.os}
      />
    </div>
  );
}
