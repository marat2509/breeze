import { useState } from 'react';
import {
  Play,
  RotateCcw,
  RefreshCw,
  Monitor,
  Settings,
  Power,
  Shield,
  MoreHorizontal,
  X,
  AlertTriangle,
  Wrench,
  Trash2,
  XCircle,
  Package,
  MapPin,
  Zap
} from 'lucide-react';
import type { Device } from './DeviceList';
import ConnectDesktopButton from '../remote/ConnectDesktopButton';
import { useI18n } from '@/i18n/react';

type DeviceActionsProps = {
  device: Device;
  onAction?: (action: string, device: Device) => void;
  compact?: boolean;
};

type ModalType = 'none' | 'reboot' | 'reboot_safe_mode' | 'shutdown' | 'maintenance' | 'decommission' | 'clear-sessions';

export default function DeviceActions({ device, onAction, compact = false }: DeviceActionsProps) {
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const [modalType, setModalType] = useState<ModalType>('none');
  const [loading, setLoading] = useState(false);

  const handleAction = async (action: string) => {
    if (action === 'reboot' || action === 'reboot_safe_mode' || action === 'shutdown' || action === 'maintenance' || action === 'decommission' || action === 'clear-sessions') {
      setModalType(action);
      setMenuOpen(false);
      return;
    }

    setLoading(true);
    try {
      await onAction?.(action, device);
    } finally {
      setLoading(false);
      setMenuOpen(false);
    }
  };

  const handleConfirm = async () => {
    if (modalType === 'none') return;

    setLoading(true);
    try {
      await onAction?.(modalType, device);
      setModalType('none');
    } finally {
      setLoading(false);
    }
  };

  const closeModal = () => {
    if (!loading) {
      setModalType('none');
    }
  };
  const maintenanceLabel = device.status === 'maintenance'
    ? t('devices.actions.exitMaintenance')
    : t('devices.actions.enterMaintenance');
  const remoteToolsDisabledTitle = device.remoteAccessPolicy?.remoteTools === false
    ? t('devices.actions.remoteToolsDisabledByPolicy', {
      policy: device.remoteAccessPolicy?.policyName ? ` "${device.remoteAccessPolicy.policyName}"` : '',
    })
    : undefined;

  if (compact) {
    return (
      <>
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={t('devices.actions.moreActions')}
            className="flex h-9 w-9 items-center justify-center rounded-md border hover:bg-muted"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full z-10 mt-1 w-48 rounded-md border bg-card shadow-lg">
              <button
                type="button"
                onClick={() => handleAction('run-script')}
                disabled={device.status === 'offline'}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Play className="h-4 w-4" />
                {t('devices.actions.runScript')}
              </button>
              <ConnectDesktopButton deviceId={device.id} compact disabled={device.status === 'offline'} isHeadless={device.isHeadless} desktopAccess={device.desktopAccess} remoteAccessPolicy={device.remoteAccessPolicy} />
              <button
                type="button"
                onClick={() => handleAction('remote-tools')}
                disabled={device.status === 'offline' || device.remoteAccessPolicy?.remoteTools === false}
                title={remoteToolsDisabledTitle}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Wrench className="h-4 w-4" />
                {t('devices.actions.remoteTools')}
              </button>
              <button
                type="button"
                onClick={() => handleAction('refresh')}
                disabled={device.status === 'offline'}
                title={t('devices.actions.refreshTitle')}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw className="h-4 w-4" />
                {t('devices.actions.refresh')}
              </button>
              <button
                type="button"
                onClick={() => handleAction('reboot')}
                disabled={device.status === 'offline'}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RotateCcw className="h-4 w-4" />
                {t('devices.actions.reboot')}
              </button>
              {device.status === 'offline' && (
                <button
                  type="button"
                  onClick={() => handleAction('wake')}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-muted"
                >
                  <Zap className="h-4 w-4" />
                  {t('devices.actions.wake')}
                </button>
              )}
              {device.os === 'windows' && (
                <button
                  type="button"
                  onClick={() => handleAction('reboot_safe_mode')}
                  disabled={device.status === 'offline'}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-yellow-600 hover:bg-yellow-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Shield className="h-4 w-4" />
                  {t('devices.actions.rebootSafeMode')}
                </button>
              )}
              <button
                type="button"
                onClick={() => handleAction('deploy-software')}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-muted"
              >
                <Package className="h-4 w-4" />
                {t('devices.actions.deploySoftware')}
              </button>
              <button
                type="button"
                onClick={() => handleAction('clear-sessions')}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-muted"
              >
                <XCircle className="h-4 w-4" />
                {t('devices.actions.clearSessions')}
              </button>
              <hr className="my-1" />
              <button
                type="button"
                onClick={() => handleAction('change-site')}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-muted"
              >
                <MapPin className="h-4 w-4" />
                {t('devices.actions.changeSite')}
              </button>
              <button
                type="button"
                onClick={() => handleAction('maintenance')}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-muted"
              >
                <Shield className="h-4 w-4" />
                {maintenanceLabel}
              </button>
              <hr className="my-1" />
              <button
                type="button"
                onClick={() => handleAction('decommission')}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
                {t('devices.actions.decommission')}
              </button>
            </div>
          )}
        </div>

        {/* Confirmation Modals */}
        {modalType !== 'none' && (
          <ConfirmationModal
            type={modalType}
            device={device}
            loading={loading}
            onConfirm={handleConfirm}
            onCancel={closeModal}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => handleAction('run-script')}
          disabled={device.status === 'offline' || loading}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Play className="h-4 w-4" />
          {t('devices.actions.runScript')}
        </button>
        <ConnectDesktopButton deviceId={device.id} disabled={device.status === 'offline'} isHeadless={device.isHeadless} desktopAccess={device.desktopAccess} remoteAccessPolicy={device.remoteAccessPolicy} />
        <button
          type="button"
          onClick={() => handleAction('remote-tools')}
          disabled={device.status === 'offline' || loading || device.remoteAccessPolicy?.remoteTools === false}
          title={remoteToolsDisabledTitle}
          className="flex items-center gap-2 rounded-md border bg-background px-4 py-2 text-sm font-medium transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Wrench className="h-4 w-4" />
          {t('devices.actions.remoteTools')}
        </button>
        <button
          type="button"
          onClick={() => handleAction('refresh')}
          disabled={device.status === 'offline' || loading}
          title={t('devices.actions.refreshTitle')}
          className="flex items-center gap-2 rounded-md border bg-background px-4 py-2 text-sm font-medium transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className="h-4 w-4" />
          {t('devices.actions.refresh')}
        </button>
        <button
          type="button"
          onClick={() => handleAction('reboot')}
          disabled={device.status === 'offline' || loading}
          className="flex items-center gap-2 rounded-md border bg-background px-4 py-2 text-sm font-medium transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RotateCcw className="h-4 w-4" />
          {t('devices.actions.reboot')}
        </button>
        {device.status === 'offline' && (
          <button
            type="button"
            onClick={() => handleAction('wake')}
            disabled={loading}
            className="flex items-center gap-2 rounded-md border bg-background px-4 py-2 text-sm font-medium transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            title={t('devices.actions.wakeTitle')}
          >
            <Zap className="h-4 w-4" />
            {t('devices.actions.wake')}
          </button>
        )}

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            disabled={loading}
            aria-label={t('devices.actions.moreActions')}
            className="flex h-10 w-10 items-center justify-center rounded-md border bg-background transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full z-10 mt-1 w-48 rounded-md border bg-card shadow-lg">
              <button
                type="button"
                onClick={() => handleAction('maintenance')}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-muted"
              >
                <Shield className="h-4 w-4" />
                {maintenanceLabel}
              </button>
              <button
                type="button"
                onClick={() => handleAction('deploy-software')}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-muted"
              >
                <Package className="h-4 w-4" />
                {t('devices.actions.deploySoftware')}
              </button>
              <button
                type="button"
                onClick={() => handleAction('shutdown')}
                disabled={device.status === 'offline'}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Power className="h-4 w-4" />
                {t('devices.actions.shutdown')}
              </button>
              {device.os === 'windows' && (
                <button
                  type="button"
                  onClick={() => handleAction('reboot_safe_mode')}
                  disabled={device.status === 'offline'}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-yellow-600 hover:bg-yellow-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Shield className="h-4 w-4" />
                  {t('devices.actions.rebootSafeMode')}
                </button>
              )}
              <button
                type="button"
                onClick={() => handleAction('clear-sessions')}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-muted"
              >
                <XCircle className="h-4 w-4" />
                {t('devices.actions.clearSessions')}
              </button>
              <button
                type="button"
                onClick={() => handleAction('change-site')}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-muted"
              >
                <MapPin className="h-4 w-4" />
                {t('devices.actions.changeSite')}
              </button>
              <button
                type="button"
                onClick={() => handleAction('settings')}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-muted"
              >
                <Settings className="h-4 w-4" />
                {t('devices.actions.deviceSettings')}
              </button>
              <hr className="my-1" />
              <button
                type="button"
                onClick={() => handleAction('decommission')}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
                {t('devices.actions.decommission')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modals */}
      {modalType !== 'none' && (
        <ConfirmationModal
          type={modalType}
          device={device}
          loading={loading}
          onConfirm={handleConfirm}
          onCancel={closeModal}
        />
      )}
    </>
  );
}

type ConfirmationModalProps = {
  type: ModalType;
  device: Device;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

function ConfirmationModal({ type, device, loading, onConfirm, onCancel }: ConfirmationModalProps) {
  const { t } = useI18n();
  const modalConfig = {
    reboot: {
      title: t('devices.actions.rebootDeviceTitle'),
      description: t('devices.actions.rebootDescription', { hostname: device.hostname }),
      confirmLabel: t('devices.actions.reboot'),
      confirmClass: 'bg-yellow-600 text-white hover:bg-yellow-700'
    },
    reboot_safe_mode: {
      title: t('devices.actions.rebootSafeMode'),
      description: t('devices.actions.rebootSafeModeDescription', { hostname: device.hostname }),
      confirmLabel: t('devices.actions.rebootSafeMode'),
      confirmClass: 'bg-yellow-600 text-white hover:bg-yellow-700'
    },
    shutdown: {
      title: t('devices.actions.shutdownDeviceTitle'),
      description: t('devices.actions.shutdownDescription', { hostname: device.hostname }),
      confirmLabel: t('devices.actions.shutdown'),
      confirmClass: 'bg-destructive text-destructive-foreground hover:opacity-90'
    },
    maintenance: {
      title: device.status === 'maintenance' ? t('devices.actions.exitMaintenanceModeTitle') : t('devices.actions.enterMaintenanceModeTitle'),
      description: device.status === 'maintenance'
        ? t('devices.actions.exitMaintenanceDescription', { hostname: device.hostname })
        : t('devices.actions.enterMaintenanceDescription', { hostname: device.hostname }),
      confirmLabel: device.status === 'maintenance' ? t('devices.actions.exitMaintenance') : t('devices.actions.enterMaintenance'),
      confirmClass: 'bg-primary text-primary-foreground hover:opacity-90'
    },
    decommission: {
      title: t('devices.actions.decommissionDeviceTitle'),
      description: t('devices.actions.decommissionDescription', { hostname: device.hostname }),
      confirmLabel: t('devices.actions.decommission'),
      confirmClass: 'bg-destructive text-destructive-foreground hover:opacity-90'
    },
    'clear-sessions': {
      title: t('devices.actions.clearSessions'),
      description: t('devices.actions.clearSessionsDescription', { hostname: device.hostname }),
      confirmLabel: t('devices.actions.clearSessions'),
      confirmClass: 'bg-yellow-600 text-white hover:bg-yellow-700'
    },
    none: {
      title: '',
      description: '',
      confirmLabel: '',
      confirmClass: ''
    }
  };

  const config = modalConfig[type];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-4 py-8">
      <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
              type === 'shutdown' || type === 'decommission' ? 'bg-destructive/10' : 'bg-yellow-500/10'
            }`}>
              {type === 'clear-sessions' ? (
                <XCircle className="h-5 w-5 text-yellow-600" />
              ) : (
                <AlertTriangle className={`h-5 w-5 ${
                  type === 'shutdown' || type === 'decommission' ? 'text-destructive' : 'text-yellow-600'
                }`} />
              )}
            </div>
            <h2 className="text-lg font-semibold">{config.title}</h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            aria-label={t('common.dismiss')}
            className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted disabled:cursor-not-allowed"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-4 text-sm text-muted-foreground">{config.description}</p>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="h-10 rounded-md border px-4 text-sm font-medium text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${config.confirmClass}`}
          >
            {loading ? (
              <>
                <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                {t('common.processing')}
              </>
            ) : (
              config.confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
