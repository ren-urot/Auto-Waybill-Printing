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
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error ?? 'Sync failed');
      }
      toast.success('Sync complete');
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
