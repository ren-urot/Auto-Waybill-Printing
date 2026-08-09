import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { orders, stores } from '@/db/schema';
import { safeQuery } from '@/lib/db/safe-query';
import { getDemoMode } from '@/lib/demo/mode';
import { mockOrderById, MOCK_STORES } from '@/lib/demo/mock-data';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Courier/waybill "ship from" details come from the order's own store, not
  // a generic company-wide setting — joined here rather than assumed.
  const [row] = await safeQuery(
    () =>
      db
        .select({ order: orders, storeName: stores.name, storePlatform: stores.platform })
        .from(orders)
        .leftJoin(stores, eq(orders.storeId, stores.id))
        .where(eq(orders.id, id)),
    []
  );

  if (!row) {
    if ((await getDemoMode()) === 'populated') {
      const mockOrder = mockOrderById(id);
      if (mockOrder) {
        const store = MOCK_STORES.find((s) => s.id === mockOrder.storeId);
        return NextResponse.json({ order: { ...mockOrder, storeName: store?.name, storePlatform: store?.platform } });
      }
    }
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ order: { ...row.order, storeName: row.storeName, storePlatform: row.storePlatform } });
}
