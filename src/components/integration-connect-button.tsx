'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

interface IntegrationConnectButtonProps {
  platform: 'tiktok' | 'shopee' | 'lazada';
  connected: boolean;
  storeId: string | null;
}

export function IntegrationConnectButton({ platform, connected, storeId }: IntegrationConnectButtonProps) {
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function handleConnect() {
    setPending(true);
    try {
      await fetch('/api/stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform }),
      });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function handleDisconnect() {
    if (!storeId) return;
    setPending(true);
    try {
      await fetch(`/api/stores/${storeId}`, { method: 'DELETE' });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (connected) {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:border-green-500/20 dark:bg-green-500/10 dark:text-green-300">
          Connected
        </span>
        <button
          type="button"
          onClick={handleDisconnect}
          disabled={pending}
          className="text-xs font-medium text-muted-foreground hover:text-destructive disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Disconnect'}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleConnect}
      disabled={pending}
      className="flex items-center gap-1 text-xs font-medium text-primary hover:underline disabled:opacity-50"
    >
      {pending && <Loader2 className="h-3 w-3 animate-spin" />}
      {pending ? 'Connecting…' : 'Connect'}
    </button>
  );
}
