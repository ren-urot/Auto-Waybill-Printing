import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { verifyShopifyWebhook } from '@/lib/shopify/webhook-verify';
import { upsertOrderFromShopify } from '@/lib/shopify/sync';
import { db } from '@/db/client';
import { stores } from '@/db/schema';
import type { ShopifyOrder } from '@/lib/shopify/client';

export async function POST(request: Request) {
  const rawBody = await request.text();
  const hmacHeader = request.headers.get('x-shopify-hmac-sha256');
  const shopDomain = request.headers.get('x-shopify-shop-domain');

  if (!verifyShopifyWebhook(rawBody, hmacHeader, process.env.SHOPIFY_API_SECRET ?? '')) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }
  if (!shopDomain) {
    return NextResponse.json({ error: 'Missing shop domain' }, { status: 400 });
  }

  const [store] = await db.select().from(stores).where(eq(stores.shopDomain, shopDomain));
  if (!store) {
    return NextResponse.json({ error: 'Unknown store' }, { status: 404 });
  }

  let shopifyOrder: ShopifyOrder;
  try {
    shopifyOrder = JSON.parse(rawBody) as ShopifyOrder;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Shape guard, not a topic registry: other order topics (orders/delete sends
  // only `{ id }`) can be delivered to this same endpoint. Acknowledge them
  // with a 200 no-op so Shopify doesn't retry, rather than crashing on a
  // payload that isn't a full order.
  if (!Array.isArray(shopifyOrder.line_items)) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  await upsertOrderFromShopify(db, store.id, shopifyOrder);

  return NextResponse.json({ ok: true });
}
