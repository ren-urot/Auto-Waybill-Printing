import { PieChart } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AnalyticsPage() {
  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">Deeper trends across sales, fulfillment speed, and couriers.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fulfillment Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-20 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <PieChart className="h-6 w-6 text-muted-foreground" />
            </span>
            <p className="text-sm font-medium">Analytics isn&apos;t available yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Trend analysis needs a longer history of order and pricing data than OmniShip has collected so far.
            </p>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
