// src/app/api/webhooks/shopify/orders/route.integration.test.ts
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createHmac } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@/db/schema';
import { POST } from './route';

const TEST_DB_URL = process.env.DATABASE_URL_TEST ?? 'postgres://postgres:test@localhost:5433/omniship_test';
const queryClient = postgres(TEST_DB_URL);
const testDb = drizzle(queryClient, { schema });
const WEBHOOK_SECRET = 'test-webhook-secret';

beforeAll(() => {
  process.env.DATABASE_URL = TEST_DB_URL;
  process.env.SHOPIFY_API_SECRET = WEBHOOK_SECRET;
});

beforeEach(async () => {
  await testDb.delete(schema.orders);
  await testDb.delete(schema.stores);
});

function signedRequest(shopDomain: string, payload: object) {
  const rawBody = JSON.stringify(payload);
  const hmac = createHmac('sha256', WEBHOOK_SECRET).update(rawBody, 'utf8').digest('base64');
  return new Request('http://localhost/api/webhooks/shopify/orders', {
    method: 'POST',
    headers: { 'x-shopify-hmac-sha256': hmac, 'x-shopify-shop-domain': shopDomain },
    body: rawBody,
  });
}

describe('POST /api/webhooks/shopify/orders', () => {
  it('rejects a payload with an invalid signature', async () => {
    const request = new Request('http://localhost/api/webhooks/shopify/orders', {
      method: 'POST',
      headers: { 'x-shopify-hmac-sha256': 'bogus==', 'x-shopify-shop-domain': 'shop.myshopify.com' },
      body: JSON.stringify({ id: 1 }),
    });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('upserts an order from a validly signed webhook', async () => {
    const [store] = await testDb
      .insert(schema.stores)
      .values({ name: 's', shopDomain: 's.myshopify.com', accessToken: 'x', status: 'connected' })
      .returning();

    const request = signedRequest('s.myshopify.com', {
      id: 555,
      order_number: 555,
      cancelled_at: null,
      fulfillment_status: null,
      created_at: '2026-08-01T00:00:00Z',
      updated_at: '2026-08-01T00:00:00Z',
      note: null,
      customer: { first_name: 'Cy', last_name: 'Santos' },
      shipping_address: {},
      line_items: [],
      fulfillments: [],
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const rows = await testDb.select().from(schema.orders).where(eq(schema.orders.storeId, store.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].customerName).toBe('Cy Santos');
  });
});
