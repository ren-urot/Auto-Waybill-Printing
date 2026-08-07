'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { OrderFilters } from '@/components/order-filters';
import { OrderTable, type OrderRow } from '@/components/order-table';
import { Button } from '@/components/ui/button';

// This page reads useSearchParams() and fetches live order data on every
// render. Next.js requires a Suspense boundary around any useSearchParams()
// consumer so it can bail out to client-side rendering there instead of
// failing to statically prerender the whole page at build time.
function OrdersPageContent() {
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch(`/api/orders?${searchParams.toString()}`)
      .then((res) => res.json())
      .then((data) => setOrders(data.orders));
  }, [searchParams]);

  function printSelected() {
    const ids = Array.from(selected).join(',');
    window.open(`/print/${ids}?paperSize=4x6&documentType=waybill`, '_blank');
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Orders</h1>
        <Button onClick={printSelected} disabled={selected.size === 0}>
          Print Selected ({selected.size})
        </Button>
      </div>
      <OrderFilters />
      <OrderTable orders={orders} selected={selected} onSelectionChange={setSelected} />
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
