// src/app/api/orders/route.integration.test.ts
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@/db/schema';

const TEST_DB_URL = process.env.DATABASE_URL_TEST ?? 'postgres://postgres:test@localhost:5433/omniship_test';
const queryClient = postgres(TEST_DB_URL);
const testDb = drizzle(queryClient, { schema });

// The route module reads `db` from '@/db/client' directly, so this test
// seeds the same physical test database (DATABASE_URL points at it via
// the test env, see package.json "test:integration" script) and calls
// the exported GET handler in-process.
import { GET } from './route';

beforeAll(() => {
  process.env.DATABASE_URL = TEST_DB_URL;
});

beforeEach(async () => {
  await testDb.delete(schema.orders);
  await testDb.delete(schema.stores);
});

describe('GET /api/orders', () => {
  it('filters by status and returns matching orders', async () => {
    const [store] = await testDb
      .insert(schema.stores)
      .values({ name: 's', shopDomain: 's.myshopify.com', accessToken: 'x', status: 'connected' })
      .returning();

    await testDb.insert(schema.orders).values([
      {
        storeId: store.id,
        platformOrderId: '1',
        orderNumber: '1001',
        customerName: 'Ana Cruz',
        address: {},
        items: [],
        status: 'ready_to_ship',
      },
      {
        storeId: store.id,
        platformOrderId: '2',
        orderNumber: '1002',
        customerName: 'Bea Reyes',
        address: {},
        items: [],
        status: 'printed',
      },
    ]);

    const request = new Request('http://localhost/api/orders?status=printed');
    const response = await GET(request);
    const body = await response.json();

    expect(body.orders).toHaveLength(1);
    expect(body.orders[0].customerName).toBe('Bea Reyes');
  });
});
