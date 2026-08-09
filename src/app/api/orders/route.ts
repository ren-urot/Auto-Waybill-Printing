import { NextResponse } from 'next/server';
import { and, eq, gte, lte, ilike, or, desc, asc, type SQL } from 'drizzle-orm';
import { db } from '@/db/client';
import { orders, stores } from '@/db/schema';
import { parseOrderFilters } from '@/lib/orders/filters';
import { safeQuery } from '@/lib/db/safe-query';
import { getDemoMode } from '@/lib/demo/mode';
import { mockOrderRows } from '@/lib/demo/mock-data';

/**
 * Phase 1 has no pagination UI, so this caps the response instead. Selecting
 * every column (raw_payload included) for an unbounded row count made this
 * route a multi-megabyte download that grew with the store.
 */
const MAX_ROWS = 200;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filters = parseOrderFilters(searchParams);

  const conditions: SQL[] = [];
  if (filters.status) conditions.push(eq(orders.status, filters.status));
  if (filters.courier) conditions.push(eq(orders.courier, filters.courier));
  if (filters.paymentMethod) conditions.push(eq(orders.paymentMethod, filters.paymentMethod));
  if (filters.dateFrom) {
    const from = new Date(filters.dateFrom);
    if (!Number.isNaN(from.getTime())) conditions.push(gte(orders.createdAt, from));
  }
  if (filters.dateTo) {
    const to = new Date(filters.dateTo);
    if (!Number.isNaN(to.getTime())) conditions.push(lte(orders.createdAt, to));
  }
  if (filters.keyword) {
    conditions.push(
      // Given two defined arguments, `or()` always returns a SQL fragment —
      // the `| undefined` in its type only covers the zero-argument case.
      or(ilike(orders.customerName, `%${filters.keyword}%`), ilike(orders.orderNumber, `%${filters.keyword}%`))!
    );
  }

  const orderBy =
    filters.sort === 'oldest'
      ? asc(orders.createdAt)
      : filters.sort === 'courier'
        ? asc(orders.courier)
        : desc(orders.createdAt);

  // Exactly the columns OrderTable's OrderRow consumes — nothing else crosses
  // the wire. `platform` comes from a join, not an `orders` column (see
  // src/lib/orders/filters.ts for why orders has no platform column of its
  // own) — it's read-only display data here, not a new filterable field.
  const rows = await safeQuery(
    () =>
      db
        .select({
          id: orders.id,
          orderNumber: orders.orderNumber,
          customerName: orders.customerName,
          courier: orders.courier,
          status: orders.status,
          trackingNumber: orders.trackingNumber,
          createdAt: orders.createdAt,
          platform: stores.platform,
        })
        .from(orders)
        .leftJoin(stores, eq(orders.storeId, stores.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(orderBy)
        .limit(MAX_ROWS),
    []
  );

  if (rows.length === 0 && (await getDemoMode()) === 'populated') {
    return NextResponse.json({ orders: mockOrderRows(filters) });
  }

  return NextResponse.json({ orders: rows });
}
