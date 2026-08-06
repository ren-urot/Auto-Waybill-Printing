import { NextResponse } from 'next/server';
import { and, eq, ilike, or, desc, asc } from 'drizzle-orm';
import { db } from '@/db/client';
import { orders } from '@/db/schema';
import { parseOrderFilters } from '@/lib/orders/filters';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filters = parseOrderFilters(searchParams);

  const conditions = [];
  if (filters.status) conditions.push(eq(orders.status, filters.status));
  if (filters.courier) conditions.push(eq(orders.courier, filters.courier));
  if (filters.paymentMethod) conditions.push(eq(orders.paymentMethod, filters.paymentMethod));
  if (filters.keyword) {
    conditions.push(
      or(ilike(orders.customerName, `%${filters.keyword}%`), ilike(orders.orderNumber, `%${filters.keyword}%`))
    );
  }

  const orderBy =
    filters.sort === 'oldest'
      ? asc(orders.createdAt)
      : filters.sort === 'courier'
        ? asc(orders.courier)
        : desc(orders.createdAt);

  const rows = await db
    .select()
    .from(orders)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(orderBy);

  return NextResponse.json({ orders: rows });
}
