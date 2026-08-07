'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { SyncStatusIndicator } from './sync-status-indicator';

interface DashboardSyncControlsProps {
  lastSyncedAt: string | null;
  status: 'connected' | 'error' | 'disconnected';
}

export function DashboardSyncControls({ lastSyncedAt, status }: DashboardSyncControlsProps) {
  const [syncing, setSyncing] = useState(false);
  const router = useRouter();

  async function handleSync() {
    setSyncing(true);
    try {
      const response = await fetch('/api/sync/shopify', { method: 'POST' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error ?? 'Sync failed');
      }

      // syncShopifyOrders catches its own errors and reports them per store,
      // so the route answers 200 even when every store failed. Checking only
      // response.ok showed "Sync complete" on a total failure.
      const results: Array<{ failed?: boolean; error?: string }> = Array.isArray(body.results)
        ? body.results
        : [];
      const failures = results.filter((result) => result.failed === true);
      if (failures.length > 0) {
        const detail = failures[0].error ?? 'Unknown error';
        toast.error(
          failures.length === 1
            ? `Sync failed: ${detail}`
            : `Sync failed for ${failures.length} stores: ${detail}`
        );
      } else if (results.length === 0) {
        toast.error('No connected store to sync');
      } else {
        const synced = results.reduce(
          (total, result) => total + ((result as { synced?: number }).synced ?? 0),
          0
        );
        toast.success(`Sync complete — ${synced} order${synced === 1 ? '' : 's'} updated`);
      }
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <SyncStatusIndicator
      lastSyncedAt={lastSyncedAt ? new Date(lastSyncedAt) : null}
      status={status}
      syncing={syncing}
      onSync={handleSync}
    />
  );
}
