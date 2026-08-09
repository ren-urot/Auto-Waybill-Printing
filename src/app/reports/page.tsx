import { count, eq, desc } from 'drizzle-orm';
import { ShoppingBag, Printer, Truck, XCircle } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/stat-card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { db } from '@/db/client';
import { orders, printHistory } from '@/db/schema';

// Reads live order/print-history data with no dynamic route segment or
// searchParams to trigger dynamic rendering automatically — see
// src/app/page.tsx for why this is required.
export const dynamic = 'force-dynamic';

const REPORT_TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'sales', label: 'Sales' },
  { value: 'fulfillment', label: 'Fulfillment' },
  { value: 'couriers', label: 'Couriers' },
];

export default async function ReportsPage() {
  const [totalOrders, printedCount, shippedCount, cancelledCount, printBatches] = await Promise.all([
    db.select({ value: count() }).from(orders).then(([r]) => r.value),
    db.select({ value: count() }).from(orders).where(eq(orders.status, 'printed')).then(([r]) => r.value),
    db.select({ value: count() }).from(orders).where(eq(orders.status, 'shipped')).then(([r]) => r.value),
    db.select({ value: count() }).from(orders).where(eq(orders.status, 'cancelled')).then(([r]) => r.value),
    db.select().from(printHistory).orderBy(desc(printHistory.printedAt)).limit(10),
  ]);
  const totalWaybillsPrinted = printBatches.reduce((sum, entry) => sum + entry.orderIds.length, 0);

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground">Analyze your order and fulfillment performance.</p>
      </div>

      <Tabs defaultValue="overview">
        <TabsList variant="line" className="mb-6 border-b">
          {REPORT_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard icon={ShoppingBag} label="Total Orders" value={String(totalOrders)} />
            <StatCard
              icon={Printer}
              iconClassName="bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"
              label="Waybills Printed"
              value={String(printedCount)}
            />
            <StatCard
              icon={Truck}
              iconClassName="bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400"
              label="Shipped Orders"
              value={String(shippedCount)}
            />
            <StatCard
              icon={XCircle}
              iconClassName="bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"
              label="Cancelled Orders"
              value={String(cancelledCount)}
            />
          </div>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base">Recent Print Batches</CardTitle>
            </CardHeader>
            <CardContent>
              {printBatches.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No print batches yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="pb-2 font-medium">Printed At</th>
                      <th className="pb-2 font-medium">Document</th>
                      <th className="pb-2 font-medium">Paper Size</th>
                      <th className="pb-2 font-medium">Orders</th>
                    </tr>
                  </thead>
                  <tbody>
                    {printBatches.map((entry) => (
                      <tr key={entry.id} className="border-b last:border-0">
                        <td className="py-2.5">{new Date(entry.printedAt).toLocaleString()}</td>
                        <td className="py-2.5 capitalize">{entry.documentType.replace('_', ' ')}</td>
                        <td className="py-2.5 uppercase">{entry.paperSize}</td>
                        <td className="py-2.5 font-mono">{entry.orderIds.length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <p className="mt-3 text-xs text-muted-foreground">{totalWaybillsPrinted} waybills printed across the last {printBatches.length} batches.</p>
            </CardContent>
          </Card>
        </TabsContent>

        {['sales', 'fulfillment', 'couriers'].map((tab) => (
          <TabsContent key={tab} value={tab}>
            <div className="flex flex-col items-center justify-center gap-1 rounded-[10px] border border-dashed py-16 text-center">
              <p className="text-sm font-medium capitalize">{tab} reporting isn&apos;t available yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                This report needs order-pricing and courier-performance data OmniShip doesn&apos;t track yet.
              </p>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </AppShell>
  );
}
