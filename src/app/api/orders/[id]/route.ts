import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { orders } from '@/db/schema';
import { safeQuery } from '@/lib/db/safe-query';
import { getDemoMode } from '@/lib/demo/mode';
import { mockOrderById } from '@/lib/demo/mock-data';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [order] = await safeQuery(() => db.select().from(orders).where(eq(orders.id, id)), []);

  if (!order) {
    if ((await getDemoMode()) === 'populated') {
      const mockOrder = mockOrderById(id);
      if (mockOrder) return NextResponse.json({ order: mockOrder });
    }
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ order });
}
