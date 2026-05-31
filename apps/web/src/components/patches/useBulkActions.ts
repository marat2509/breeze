import { useState, useCallback } from 'react';
import { fetchWithAuth } from '../../stores/auth';
import { navigateTo } from '@/lib/navigation';

export type BulkActionMessages = {
  scanStartFailed: string;
  scanFallbackFailed: string;
  scanQueued: (count: number) => string;
  installQueued: (count: number) => string;
  installFailed: (failedCount: number, totalCount: number) => string;
  skippedNoPending: (count: number) => string;
  noInstallable: string;
  installFallbackFailed: string;
};

type UseBulkActionsOptions = {
  resolveInstallPatchIds?: (deviceId: string) => Promise<string[]>;
  messages?: BulkActionMessages;
};

const defaultBulkActionMessages: BulkActionMessages = {
  scanStartFailed: 'Failed to start patch scan',
  scanFallbackFailed: 'Failed to start scan',
  scanQueued: (count) => `Patch scan queued for ${count} ${count === 1 ? 'device' : 'devices'}`,
  installQueued: (count) => `Patch install queued on ${count} ${count === 1 ? 'device' : 'devices'}`,
  installFailed: (failedCount, totalCount) => `Install failed on ${failedCount} of ${totalCount} devices`,
  skippedNoPending: (count) => `Skipped ${count} ${count === 1 ? 'device' : 'devices'} with no installable pending patches`,
  noInstallable: 'No installable pending patches found for the selected devices',
  installFallbackFailed: 'Failed to install patches',
};

export function useBulkActions(
  selectedIds: Set<string>,
  clearSelection: () => void,
  onRefresh: () => void,
  options: UseBulkActionsOptions = {}
) {
  const [bulkAction, setBulkAction] = useState<string | null>(null);
  const [bulkError, setBulkError] = useState<string>();
  const [bulkSuccess, setBulkSuccess] = useState<string>();
  const { messages = defaultBulkActionMessages, resolveInstallPatchIds } = options;

  const handleBulkScan = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkAction('scan');
    setBulkError(undefined);
    setBulkSuccess(undefined);
    try {
      const response = await fetchWithAuth('/patches/scan', {
        method: 'POST',
        body: JSON.stringify({ deviceIds: ids })
      });
      if (!response.ok) {
        if (response.status === 401) { void navigateTo('/login', { replace: true }); return; }
        throw new Error(messages.scanStartFailed);
      }
      setBulkSuccess(messages.scanQueued(ids.length));
      clearSelection();
      setTimeout(() => { onRefresh(); }, 3000);
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : messages.scanFallbackFailed);
    } finally {
      setBulkAction(null);
    }
  }, [selectedIds, clearSelection, onRefresh, messages]);

  const handleBulkInstall = useCallback(async (filterIds?: string[]) => {
    const ids = filterIds ?? Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkAction('install');
    setBulkError(undefined);
    setBulkSuccess(undefined);
    const failed: string[] = [];
    const skipped: string[] = [];
    try {
      for (const deviceId of ids) {
        let patchIds: string[] = [];
        if (resolveInstallPatchIds) {
          patchIds = await resolveInstallPatchIds(deviceId);
          if (patchIds.length === 0) {
            skipped.push(deviceId);
            continue;
          }
        }

        const response = await fetchWithAuth(`/devices/${deviceId}/patches/install`, {
          method: 'POST',
          body: JSON.stringify({ patchIds })
        });
        if (!response.ok) {
          if (response.status === 401) { void navigateTo('/login', { replace: true }); return; }
          failed.push(deviceId);
        }
      }

      const queuedCount = ids.length - failed.length - skipped.length;
      if (queuedCount > 0) {
        setBulkSuccess(messages.installQueued(queuedCount));
      }

      if (failed.length > 0 || skipped.length > 0) {
        const parts: string[] = [];
        if (failed.length > 0) {
          parts.push(messages.installFailed(failed.length, ids.length));
        }
        if (skipped.length > 0) {
          parts.push(messages.skippedNoPending(skipped.length));
        }
        setBulkError(parts.join('. '));
      } else if (queuedCount === 0) {
        setBulkError(messages.noInstallable);
      }

      clearSelection();
      setTimeout(() => { onRefresh(); }, 3000);
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : messages.installFallbackFailed);
    } finally {
      setBulkAction(null);
    }
  }, [selectedIds, clearSelection, onRefresh, resolveInstallPatchIds, messages]);

  return {
    bulkAction,
    bulkError,
    setBulkError,
    bulkSuccess,
    setBulkSuccess,
    handleBulkScan,
    handleBulkInstall,
  };
}
