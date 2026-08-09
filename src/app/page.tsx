import { eq, and, gte, count, desc } from 'drizzle-orm';
import { ShoppingBag, Clock, Printer, Truck, XCircle, RefreshCw, Printer as PrinterIcon, AlertTriangle } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/stat-card';
import { MiniDonutChart } from '@/components/mini-donut-chart';
import { NotificationBell } from '@/components/notification-bell';
import { DashboardSyncControls } from '@/components/dashboard-sync-controls';
import { PlatformIcon, type Platform } from '@/components/platform-icon';
import { db } from '@/db/client';
import { orders, stores, printHistory } from '@/db/schema';
import { safeQuery } from '@/lib/db/safe-query';
import { getDemoMode } from '@/lib/demo/mode';
import { computeMockDashboardData } from '@/lib/demo/mock-data';

// Without this, Next.js statically prerenders this page at build time and
// bakes in whatever order counts existed then — every visitor would see
// stale counts until the next deploy. This is a live dashboard; it must
// render fresh on every request.
export const dynamic = 'force-dynamic';

const DONUT_COLORS: Record<string, string> = {
  ready_to_ship: '#3b82f6',
  printed: '#6366f1',
  shipped: '#22c55e',
  cancelled: '#ef4444',
};

async function countByStatus(storeId: string | undefined, status: string) {
  const conditions = storeId ? and(eq(orders.status, status), eq(orders.storeId, storeId)) : eq(orders.status, status);
  const [{ value }] = await db.select({ value: count() }).from(orders).where(conditions);
  return value;
}

async function loadDashboardData() {
  const allStores = await db.select().from(stores);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const [{ value: todayOrders }] = await db.select({ value: count() }).from(orders).where(gte(orders.createdAt, todayStart));

  const [readyToShip, printed, shipped, cancelled] = await Promise.all([
    countByStatus(undefined, 'ready_to_ship'),
    countByStatus(undefined, 'printed'),
    countByStatus(undefined, 'shipped'),
    countByStatus(undefined, 'cancelled'),
  ]);

  const storeSummaries = await Promise.all(
    allStores.map(async (store) => {
      const [total, ready, storePrinted, storeShipped, storeCancelled] = await Promise.all([
        db
          .select({ value: count() })
          .from(orders)
          .where(eq(orders.storeId, store.id))
          .then(([r]) => r.value),
        countByStatus(store.id, 'ready_to_ship'),
        countByStatus(store.id, 'printed'),
        countByStatus(store.id, 'shipped'),
        countByStatus(store.id, 'cancelled'),
      ]);
      return { store, total, ready, printed: storePrinted, shipped: storeShipped, cancelled: storeCancelled };
    })
  );

  const recentPrints = await db.select().from(printHistory).orderBy(desc(printHistory.printedAt)).limit(5);

  return { allStores, todayOrders, readyToShip, printed, shipped, cancelled, storeSummaries, recentPrints };
}

export default async function DashboardPage() {
  const demoMode = await getDemoMode();
  const real = await safeQuery<Awaited<ReturnType<typeof loadDashboardData>>>(loadDashboardData, {
    allStores: [],
    todayOrders: 0,
    readyToShip: 0,
    printed: 0,
    shipped: 0,
    cancelled: 0,
    storeSummaries: [],
    recentPrints: [],
  });
  // Mock data only ever fills in where the real result is empty — a "Log
  // in" demo path fills an empty/unreachable database with sample data, a
  // "Create an account" demo path stays genuinely empty.
  const { allStores, todayOrders, readyToShip, printed, shipped, cancelled, storeSummaries, recentPrints } =
    demoMode === 'populated' && real.allStores.length === 0 ? computeMockDashboardData() : real;

  const primaryStore = allStores[0];
  const failedSync = allStores.filter((store) => store.status === 'error').length;
  const totalOrders = storeSummaries.reduce((sum, s) => sum + s.total, 0);

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Overview of your stores and orders</p>
        </div>
        <div className="flex items-center gap-3">
          <NotificationBell />
          {primaryStore && (
            <DashboardSyncControls
              lastSyncedAt={primaryStore.lastSyncedAt?.toISOString() ?? null}
              status={primaryStore.status as 'connected' | 'error' | 'disconnected'}
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard
          icon={ShoppingBag}
          iconClassName="bg-orange-50 text-primary dark:bg-orange-500/10"
          label="Today's Orders"
          value={String(todayOrders)}
        />
        <StatCard
          icon={Clock}
          iconClassName="bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"
          label="Ready to Print"
          value={String(readyToShip)}
        />
        <StatCard
          icon={Printer}
          iconClassName="bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"
          label="Printed"
          value={String(printed)}
        />
        <StatCard
          icon={Truck}
          iconClassName="bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400"
          label="Shipped"
          value={String(shipped)}
        />
        <StatCard
          icon={XCircle}
          iconClassName="bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"
          label="Cancelled"
          value={String(cancelled)}
        />
        <StatCard
          icon={RefreshCw}
          iconClassName="bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400"
          label="Failed Sync"
          value={String(failedSync)}
        />
      </div>

      {/* Row 2: Orders Summary (wide) + Sales Overview (narrow) */}
      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Orders Summary</CardTitle>
          </CardHeader>
          <CardContent>
            {storeSummaries.length === 0 ? (
              <EmptyState message="No store connected yet. Go to Settings to connect Shopify." href="/settings/store" cta="Connect Shopify" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="pb-2 font-medium">Platform</th>
                      <th className="pb-2 font-medium">Total Orders</th>
                      <th className="pb-2 font-medium">Ready to Print</th>
                      <th className="pb-2 font-medium">Printed</th>
                      <th className="pb-2 font-medium">Shipped</th>
                      <th className="pb-2 font-medium">Cancelled</th>
                    </tr>
                  </thead>
                  <tbody>
                    {storeSummaries.map(({ store, total, ready, printed: p, shipped: s, cancelled: c }) => (
                      <tr key={store.id} className="border-b last:border-0">
                        <td className="py-2.5 font-medium capitalize">{store.platform}</td>
                        <td className="py-2.5 font-mono">{total}</td>
                        <td className="py-2.5 font-mono">{ready}</td>
                        <td className="py-2.5 font-mono">{p}</td>
                        <td className="py-2.5 font-mono">{s}</td>
                        <td className="py-2.5 font-mono">{c}</td>
                      </tr>
                    ))}
                    <tr className="font-semibold">
                      <td className="pt-2.5">Total</td>
                      <td className="pt-2.5 font-mono">{totalOrders}</td>
                      <td className="pt-2.5 font-mono">{readyToShip}</td>
                      <td className="pt-2.5 font-mono">{printed}</td>
                      <td className="pt-2.5 font-mono">{shipped}</td>
                      <td className="pt-2.5 font-mono">{cancelled}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sales Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-40 flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-center">
              <p className="text-sm font-medium text-muted-foreground">Revenue tracking isn&apos;t available yet</p>
              <p className="text-xs text-muted-foreground">Order pricing sync is planned for a future update.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Top Stores by Orders + Recent Activities + Orders by Status */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Stores by Orders</CardTitle>
          </CardHeader>
          <CardContent>
            {storeSummaries.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No stores connected yet.</p>
            ) : (
              <ul className="space-y-3">
                {storeSummaries
                  .slice()
                  .sort((a, b) => b.total - a.total)
                  .map(({ store, total }) => {
                    const widthPct = totalOrders > 0 ? Math.max((total / totalOrders) * 100, 4) : 0;
                    return (
                      <li key={store.id} className="flex items-center gap-3 text-sm">
                        <PlatformIcon platform={store.platform as Platform} className="h-4 w-4 shrink-0" />
                        <span className="w-24 shrink-0 truncate">{store.name}</span>
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <span className="block h-full rounded-full bg-primary" style={{ width: `${widthPct}%` }} />
                        </span>
                        <span className="w-20 shrink-0 text-right font-mono text-muted-foreground">
                          {total} orders
                        </span>
                      </li>
                    );
                  })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Activities</CardTitle>
          </CardHeader>
          <CardContent>
            {recentPrints.length === 0 && !primaryStore?.lastError ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {primaryStore?.status === 'error' && primaryStore.lastError && (
                  <li className="flex items-start gap-2.5">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                    <span className="min-w-0">
                      <span className="block truncate text-destructive">{primaryStore.lastError}</span>
                      <span className="text-xs text-muted-foreground">Sync failed</span>
                    </span>
                  </li>
                )}
                {recentPrints.map((entry) => (
                  <li key={entry.id} className="flex items-start gap-2.5">
                    <PrinterIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0">
                      <span className="block">
                        {entry.orderIds.length} {entry.documentType === 'waybill' ? 'waybill' : 'packing slip'}
                        {entry.orderIds.length === 1 ? '' : 's'} printed
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(entry.printedAt).toLocaleString()}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Orders by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <MiniDonutChart
              centerLabel="Total Orders"
              centerValue={String(totalOrders)}
              segments={[
                { label: 'Ready to Print', value: readyToShip, color: DONUT_COLORS.ready_to_ship },
                { label: 'Printed', value: printed, color: DONUT_COLORS.printed },
                { label: 'Shipped', value: shipped, color: DONUT_COLORS.shipped },
                { label: 'Cancelled', value: cancelled, color: DONUT_COLORS.cancelled },
              ]}
            />
          </CardContent>
        </Card>
      </div>

      {!primaryStore && (
        <EmptyStoreCallout />
      )}
    </AppShell>
  );
}

function EmptyState({ message, href, cta }: { message: string; href: string; cta: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-10 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
      <a
        href={href}
        className="inline-flex items-center rounded-lg bg-primary py-[15px] px-[31px] text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        {cta}
      </a>
    </div>
  );
}

function EmptyStoreCallout() {
  return (
    <div className="mt-6 flex flex-col items-center justify-center gap-3 rounded-[10px] border border-dashed py-10 text-center">
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
  );
}
