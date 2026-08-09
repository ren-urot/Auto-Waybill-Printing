'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Printer, RefreshCw } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { OrderFilters } from '@/components/order-filters';
import { OrderTable, type OrderRow } from '@/components/order-table';
import { NotificationBell } from '@/components/notification-bell';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// This page reads useSearchParams() and fetches live order data on every
// render. Next.js requires a Suspense boundary around any useSearchParams()
// consumer so it can bail out to client-side rendering there instead of
// failing to statically prerender the whole page at build time.
function OrdersPageContent() {
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    // Not resetting `loading` to true here is deliberate: the list stays on
    // screen while a filter change refetches, instead of flashing back to
    // the loading state on every keystroke/tab click. `loading` only
    // reflects the very first fetch.
    fetch(`/api/orders?${searchParams.toString()}`)
      .then((res) => res.json())
      .then((data) => setOrders(Array.isArray(data.orders) ? data.orders : []))
      .finally(() => setLoading(false));
  }, [searchParams]);

  function printSelected() {
    const ids = Array.from(selected).join(',');
    window.open(`/print/${ids}?paperSize=4x6&documentType=waybill`, '_blank');
  }

  async function syncNow() {
    setSyncing(true);
    try {
      const response = await fetch('/api/sync/shopify', { method: 'POST' });
      if (!response.ok) throw new Error('Sync failed');
      toast.success('Sync started');
      const refreshed = await fetch(`/api/orders?${searchParams.toString()}`).then((r) => r.json());
      setOrders(Array.isArray(refreshed.orders) ? refreshed.orders : []);
    } catch {
      toast.error('Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
          <p className="text-sm text-muted-foreground">Manage and process orders synced from Shopify.</p>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <Button variant="outline" onClick={syncNow} disabled={syncing}>
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing…' : 'Sync Now'}
          </Button>
          <Button onClick={printSelected} disabled={selected.size === 0}>
            <Printer className="h-4 w-4" />
            Print Selected ({selected.size})
          </Button>
        </div>
      </div>

      <div className="mb-4">
        <OrderFilters />
      </div>

      {loading ? (
        <div className="rounded-lg border py-16 text-center text-sm text-muted-foreground">Loading orders…</div>
      ) : (
        <>
          <OrderTable orders={orders} selected={selected} onSelectionChange={setSelected} />
          <p className="mt-3 text-xs text-muted-foreground">
            Showing {orders.length} order{orders.length === 1 ? '' : 's'}
          </p>
        </>
      )}
    </AppShell>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={null}>
      <OrdersPageContent />
    </Suspense>
  );
}
