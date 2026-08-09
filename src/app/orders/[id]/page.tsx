import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, MapPin, Printer, FileText, Mail, RefreshCcw, Ban } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/status-badge';
import { db } from '@/db/client';
import { orders } from '@/db/schema';
import { statusLabel } from '@/lib/orders/status';

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
}

const TIMELINE_STEPS = ['ready_to_ship', 'printed', 'shipped'] as const;

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { id } = await params;
  const [order] = await db.select().from(orders).where(eq(orders.id, id));
  if (!order) notFound();

  const address = (order.address ?? {}) as Record<string, string>;
  const items = (order.items ?? []) as Array<{ sku: string | null; title: string; quantity: number }>;
  const fullAddress = [address.address1, address.city, address.province, address.zip].filter(Boolean).join(', ');
  const currentStepIndex = order.status === 'cancelled' ? -1 : TIMELINE_STEPS.indexOf(order.status as (typeof TIMELINE_STEPS)[number]);

  return (
    <AppShell>
      <Link href="/orders" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Orders
      </Link>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="font-mono text-2xl font-semibold">Order #{order.orderNumber}</h1>
          <StatusBadge status={order.status} />
        </div>
        <div className="flex gap-2">
          <a href={`/print/${order.id}?paperSize=4x6&documentType=waybill`} target="_blank" rel="noreferrer">
            <Button>
              <Printer className="h-4 w-4" />
              Print Waybill
            </Button>
          </a>
          <a href={`/print/${order.id}?paperSize=letter&documentType=packing_slip`} target="_blank" rel="noreferrer">
            <Button variant="outline">
              <FileText className="h-4 w-4" />
              Print Packing List
            </Button>
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              <p className="font-medium">{order.customerName}</p>
              {order.phone && <p className="text-muted-foreground">{order.phone}</p>}
              {fullAddress && <p className="text-muted-foreground">{fullAddress}</p>}
              {fullAddress && (
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(fullAddress)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 pt-1 text-sm text-primary hover:underline"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  View on map
                </a>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Order Items ({items.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {items.map((item, i) => (
                  <li key={i} className="flex items-center justify-between gap-4 py-2.5 text-sm first:pt-0 last:pb-0">
                    <span>
                      <span className="font-medium">{item.title}</span>
                      {item.sku && <span className="ml-2 font-mono text-xs text-muted-foreground">{item.sku}</span>}
                    </span>
                    <span className="shrink-0 font-mono text-muted-foreground">×{item.quantity}</span>
                  </li>
                ))}
                {items.length === 0 && <li className="py-4 text-sm text-muted-foreground">No items on this order.</li>}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-4">
                <TimelineStep label="Order placed" timestamp={order.createdAt} reached />
                {order.status === 'cancelled' ? (
                  <TimelineStep label="Cancelled" timestamp={order.syncedAt} reached destructive />
                ) : (
                  TIMELINE_STEPS.map((step, i) => (
                    <TimelineStep
                      key={step}
                      label={statusLabel(step)}
                      timestamp={i === currentStepIndex ? order.syncedAt : undefined}
                      reached={i <= currentStepIndex}
                      current={i === currentStepIndex}
                    />
                  ))
                )}
              </ol>
            </CardContent>
          </Card>

          {order.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Customer Note</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">{order.notes}</CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Shipping Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Field label="Courier" value={order.courier ?? '—'} />
              <Field label="Tracking Number" value={order.trackingNumber ?? '—'} mono />
              <Field label="Shipping Fee" value={order.shippingFee ?? '—'} />
              <Field label="Payment Method" value={order.paymentMethod ?? '—'} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Order Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <a href={`/print/${order.id}?paperSize=4x6&documentType=waybill`} target="_blank" rel="noreferrer" className="block">
                <Button variant="outline" className="w-full justify-start">
                  <Printer className="h-4 w-4" />
                  Print Waybill
                </Button>
              </a>
              <a href={`/print/${order.id}?paperSize=letter&documentType=packing_slip`} target="_blank" rel="noreferrer" className="block">
                <Button variant="outline" className="w-full justify-start">
                  <FileText className="h-4 w-4" />
                  Print Packing List
                </Button>
              </a>
              <Button variant="outline" className="w-full justify-start" disabled title="Coming soon">
                <Mail className="h-4 w-4" />
                Send Invoice
              </Button>
              <Button variant="outline" className="w-full justify-start text-destructive" disabled title="Coming soon">
                <RefreshCcw className="h-4 w-4" />
                Refund Order
              </Button>
              <Button variant="outline" className="w-full justify-start text-destructive" disabled title="Coming soon">
                <Ban className="h-4 w-4" />
                Cancel Order
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Order Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Field label="Order ID" value={order.orderNumber} mono />
              <Field label="Source" value="Shopify" />
              <Field label="Synced" value={new Date(order.syncedAt).toLocaleString()} />
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function Field({ label, value, mono }: { label: string; value: string | number; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? 'font-mono' : ''}>{value}</span>
    </div>
  );
}

function TimelineStep({
  label,
  timestamp,
  reached,
  current,
  destructive,
}: {
  label: string;
  timestamp?: Date | null;
  reached?: boolean;
  current?: boolean;
  destructive?: boolean;
}) {
  return (
    <li className="flex gap-3">
      <span
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
          destructive
            ? 'border-destructive bg-destructive'
            : reached
              ? 'border-primary bg-primary'
              : 'border-muted-foreground/30 bg-background'
        }`}
      />
      <span>
        <span className={`block text-sm ${reached || destructive ? 'font-medium' : 'text-muted-foreground'}`}>
          {label}
          {current && <span className="ml-2 text-xs font-normal text-primary">Current</span>}
        </span>
        <span className="text-xs text-muted-foreground">{timestamp ? new Date(timestamp).toLocaleString() : '—'}</span>
      </span>
    </li>
  );
}

