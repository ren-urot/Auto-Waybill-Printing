import { eq, count } from 'drizzle-orm';
import { AppShell } from '@/components/app-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardSyncControls } from '@/components/dashboard-sync-controls';
import { db } from '@/db/client';
import { orders, stores } from '@/db/schema';

const STATUS_TILES = ['pending', 'ready_to_ship', 'printed', 'shipped', 'cancelled'] as const;

export default async function DashboardPage() {
  const [store] = await db.select().from(stores).limit(1);

  const counts = await Promise.all(
    STATUS_TILES.map(async (status) => {
      const [{ value }] = await db
        .select({ value: count() })
        .from(orders)
        .where(eq(orders.status, status));
      return { status, value };
    })
  );

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        {store && (
          <DashboardSyncControls
            lastSyncedAt={store.lastSyncedAt?.toISOString() ?? null}
            status={store.status as 'connected' | 'error' | 'disconnected'}
          />
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {counts.map(({ status, value }) => (
          <Card key={status}>
            <CardHeader>
              <CardTitle className="text-sm font-normal text-muted-foreground capitalize">
                {status.replace('_', ' ')}
              </CardTitle>
            </CardHeader>
            <CardContent className="font-mono text-3xl">{value}</CardContent>
          </Card>
        ))}
      </div>
      {!store && (
        <p className="mt-6 text-sm text-muted-foreground">
          No store connected yet. Go to Settings to connect Shopify.
        </p>
      )}
    </AppShell>
  );
}
