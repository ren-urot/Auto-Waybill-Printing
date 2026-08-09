import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SyncStatusIndicatorProps {
  lastSyncedAt: Date | null;
  status: 'connected' | 'error' | 'disconnected';
  syncing: boolean;
  onSync: () => void;
}

export function SyncStatusIndicator({ lastSyncedAt, status, syncing, onSync }: SyncStatusIndicatorProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground">
        {status === 'error'
          ? 'Sync failed'
          : lastSyncedAt
            ? `Last synced ${lastSyncedAt.toLocaleTimeString()}`
            : 'Never synced'}
      </span>
      <Button onClick={onSync} disabled={syncing}>
        <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
        {syncing ? 'Syncing…' : 'Sync Now'}
      </Button>
    </div>
  );
}
