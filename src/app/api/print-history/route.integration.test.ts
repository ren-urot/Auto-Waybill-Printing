// src/app/api/print-history/route.integration.test.ts
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@/db/schema';

const TEST_DB_URL = process.env.DATABASE_URL_TEST ?? 'postgres://postgres:test@localhost:5433/omniship_test';
const queryClient = postgres(TEST_DB_URL);
const testDb = drizzle(queryClient, { schema });

// The route's only non-DB dependency is the Supabase session lookup. Stubbing
// just that lets the rest of the handler run for real against Postgres.
const currentUser = { value: null as { id: string } | null };
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: async () => ({ data: { user: currentUser.value } }) },
  }),
}));

import { POST } from './route';

beforeAll(() => {
  process.env.DATABASE_URL = TEST_DB_URL;
});

beforeEach(async () => {
  currentUser.value = { id: 'user-1' };
  await testDb.delete(schema.printHistory);
  await testDb.delete(schema.orders);
  await testDb.delete(schema.stores);
});

async function seedOrders(statuses: string[]) {
  const [store] = await testDb
    .insert(schema.stores)
    .values({ name: 's', shopDomain: 's.myshopify.com', accessToken: 'x', status: 'connected' })
    .returning();

  return testDb
    .insert(schema.orders)
    .values(
      statuses.map((status, i) => ({
        storeId: store.id,
        platformOrderId: String(i + 1),
        orderNumber: String(1000 + i),
        customerName: `Customer ${i}`,
        address: {},
        items: [],
        status,
      }))
    )
    .returning();
}

function postRequest(body: unknown) {
  return new Request('http://localhost/api/print-history', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/print-history', () => {
  it('rejects an unauthenticated request with 401 and writes nothing', async () => {
    const [order] = await seedOrders(['ready_to_ship']);
    currentUser.value = null;

    const response = await POST(postRequest({ orderIds: [order.id], paperSize: '4x6', documentType: 'waybill' }));

    expect(response.status).toBe(401);
    expect(await testDb.select().from(schema.printHistory)).toHaveLength(0);
    const [after] = await testDb.select().from(schema.orders).where(eq(schema.orders.id, order.id));
    expect(after.status).toBe('ready_to_ship');
  });

  it('rejects a malformed body with 400 before touching the database', async () => {
    const response = await POST(postRequest({ orderIds: 'not-an-array', paperSize: 'huge' }));

    expect(response.status).toBe(400);
    expect(await testDb.select().from(schema.printHistory)).toHaveLength(0);
  });

  it('logs the print and advances the printed orders to status "printed"', async () => {
    const seeded = await seedOrders(['ready_to_ship', 'pending']);
    const ids = seeded.map((order) => order.id);

    const response = await POST(postRequest({ orderIds: ids, paperSize: '4x6', documentType: 'waybill' }));
    expect(response.status).toBe(200);

    const history = await testDb.select().from(schema.printHistory);
    expect(history).toHaveLength(1);
    expect(history[0].orderIds).toEqual(ids);
    expect(history[0].printedBy).toBe('user-1');

    const after = await testDb.select().from(schema.orders).where(inArray(schema.orders.id, ids));
    expect(after.map((order) => order.status).sort()).toEqual(['printed', 'printed']);
  });

  it('advances on a packing slip too — phase 1 has no separate "packed" action', async () => {
    const [order] = await seedOrders(['ready_to_ship']);

    await POST(postRequest({ orderIds: [order.id], paperSize: 'a5', documentType: 'packing_slip' }));

    const [after] = await testDb.select().from(schema.orders).where(eq(schema.orders.id, order.id));
    expect(after.status).toBe('printed');
  });

  it('does not downgrade a shipped or cancelled order', async () => {
    const seeded = await seedOrders(['shipped', 'cancelled', 'ready_to_ship']);
    const ids = seeded.map((order) => order.id);

    await POST(postRequest({ orderIds: ids, paperSize: '4x6', documentType: 'waybill' }));

    const after = await testDb.select().from(schema.orders).where(inArray(schema.orders.id, ids));
    const byOrderNumber = Object.fromEntries(after.map((order) => [order.orderNumber, order.status]));
    expect(byOrderNumber['1000']).toBe('shipped');
    expect(byOrderNumber['1001']).toBe('cancelled');
    expect(byOrderNumber['1002']).toBe('printed');
  });
});
