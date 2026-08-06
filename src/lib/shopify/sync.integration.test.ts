// src/lib/shopify/sync.integration.test.ts
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@/db/schema';
import { syncShopifyOrders } from './sync';
import type { ShopifyOrder } from './client';

const TEST_DB_URL = process.env.DATABASE_URL_TEST ?? 'postgres://postgres:test@localhost:5433/omniship_test';
const queryClient = postgres(TEST_DB_URL);
const testDb = drizzle(queryClient, { schema });

function fakeShopifyOrder(id: number, overrides: Partial<ShopifyOrder> = {}): ShopifyOrder {
  return {
    id,
    order_number: id,
    cancelled_at: null,
    fulfillment_status: null,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    note: null,
    customer: { first_name: 'Ana', last_name: 'Cruz', phone: '0917' },
    shipping_address: { address1: '123 Rd', city: 'Manila', province: 'NCR', zip: '1000', country: 'PH' },
    line_items: [{ sku: 'SKU1', title: 'Shirt', quantity: 1 }],
    fulfillments: [],
    ...overrides,
  };
}

beforeAll(async () => {
  process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
});

beforeEach(async () => {
  await testDb.delete(schema.orders);
  await testDb.delete(schema.stores);
});

describe('syncShopifyOrders', () => {
  it('inserts new orders and updates store.lastSyncedAt', async () => {
    const [store] = await testDb
      .insert(schema.stores)
      .values({
        name: 'test-shop',
        shopDomain: 'test-shop.myshopify.com',
        accessToken: 'encrypted-token-placeholder',
        status: 'connected',
      })
      .returning();

    const result = await syncShopifyOrders(store.id, {
      db: testDb,
      fetchOrders: async () => [fakeShopifyOrder(1), fakeShopifyOrder(2)],
      decrypt: () => 'plaintext-token',
    });

    expect(result).toEqual({ synced: 2, failed: false });

    const rows = await testDb.select().from(schema.orders);
    expect(rows).toHaveLength(2);

    const [updatedStore] = await testDb
      .select()
      .from(schema.stores)
      .where(eq(schema.stores.id, store.id));
    expect(updatedStore.lastSyncedAt).not.toBeNull();
  });

  it('records a failure on the store when the Shopify fetch throws', async () => {
    const [store] = await testDb
      .insert(schema.stores)
      .values({
        name: 'test-shop',
        shopDomain: 'test-shop.myshopify.com',
        accessToken: 'encrypted-token-placeholder',
        status: 'connected',
      })
      .returning();

    const result = await syncShopifyOrders(store.id, {
      db: testDb,
      fetchOrders: async () => {
        throw new Error('rate limited');
      },
      decrypt: () => 'plaintext-token',
    });

    expect(result.failed).toBe(true);
    expect(result.error).toContain('rate limited');

    const [updatedStore] = await testDb
      .select()
      .from(schema.stores)
      .where(eq(schema.stores.id, store.id));
    expect(updatedStore.status).toBe('error');
    expect(updatedStore.lastError).toContain('rate limited');
  });
});
