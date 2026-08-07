import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { db } from '@/db/client';
import { orders } from '@/db/schema';

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { id } = await params;
  const [order] = await db.select().from(orders).where(eq(orders.id, id));
  if (!order) notFound();

  const address = order.address as Record<string, string>;
  const items = order.items as Array<{ sku: string | null; title: string; quantity: number }>;

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold font-mono">Order #{order.orderNumber}</h1>
        <div className="flex gap-2">
          <a href={`/print/${order.id}?paperSize=4x6&documentType=waybill`} target="_blank" rel="noreferrer">
            <Button variant="outline">Print Waybill</Button>
          </a>
          <a href={`/print/${order.id}?paperSize=letter&documentType=packing_slip`} target="_blank" rel="noreferrer">
            <Button variant="outline">Print Packing Slip</Button>
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Customer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>{order.customerName}</p>
            <p>{order.phone}</p>
            <p>
              {address.address1}, {address.city}, {address.province} {address.zip}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Shipping</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>Courier: {order.courier ?? '—'}</p>
            <p className="font-mono">Tracking: {order.trackingNumber ?? '—'}</p>
            <p>Fee: {order.shippingFee ?? '—'}</p>
            <p>Payment: {order.paymentMethod ?? '—'}</p>
          </CardContent>
        </Card>

        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Products</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm space-y-1">
              {items.map((item, i) => (
                <li key={i}>
                  {item.quantity}× {item.title} {item.sku ? `(${item.sku})` : ''}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {order.notes && (
          <Card className="col-span-2">
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">{order.notes}</CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
