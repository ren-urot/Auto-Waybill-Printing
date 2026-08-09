import { count, eq } from 'drizzle-orm';
import { Plus } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlatformIcon, type Platform } from '@/components/platform-icon';
import { db } from '@/db/client';
import { stores, orders } from '@/db/schema';

// Reads live store/order data with no dynamic route segment or searchParams
// to trigger dynamic rendering automatically — without this, Next.js bakes
// the store list in at build time (see src/app/page.tsx for the same fix).
export const dynamic = 'force-dynamic';

export default async function StoresPage() {
  const allStores = await db.select().from(stores);
  const storeOrderCounts = await Promise.all(
    allStores.map(async (store) => {
      const [{ value }] = await db.select({ value: count() }).from(orders).where(eq(orders.storeId, store.id));
      return value;
    })
  );

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Stores</h1>
          <p className="text-sm text-muted-foreground">Connected sales channels syncing orders into OmniShip.</p>
        </div>
        <Button disabled title="Multi-store support is coming in a future update">
          <Plus className="h-4 w-4" />
          Add Store
        </Button>
      </div>

      {allStores.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-[10px] border border-dashed py-16 text-center">
          <p className="text-sm font-medium">No store connected yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Connect your Shopify store to start syncing orders and printing waybills.
          </p>
          <a
            href="/settings/store"
            className="inline-flex items-center rounded-lg bg-primary py-[15px] px-[31px] text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Connect Shopify Store
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {allStores.map((store, i) => (
            <Card key={store.id}>
              <CardContent className="space-y-3 py-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-muted p-2">
                    <PlatformIcon platform={store.platform as Platform} className="h-full w-full" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{store.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{store.platform}</p>
                  </div>
                </div>
                <dl className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Orders synced</dt>
                    <dd className="font-mono">{storeOrderCounts[i]}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Status</dt>
                    <dd className="capitalize">{store.status}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Last synced</dt>
                    <dd>{store.lastSyncedAt ? new Date(store.lastSyncedAt).toLocaleString() : 'Never'}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <p className="mt-6 text-xs text-muted-foreground">
        OmniShip currently supports one connected Shopify store. TikTok Shop and Shopee are planned for a future
        update.
      </p>
    </AppShell>
  );
}
