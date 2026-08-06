// src/lib/shopify/sync.ts
import { eq } from 'drizzle-orm';
import { db as defaultDb } from '@/db/client';
import { stores, orders } from '@/db/schema';
import { fetchShopifyOrders as defaultFetchOrders, type ShopifyOrder } from './client';
import { mergeOrderUpdate } from './merge';
import { decryptToken as defaultDecrypt } from '@/lib/crypto';

export interface SyncResult {
  synced: number;
  failed: boolean;
  error?: string;
}

export interface SyncDeps {
  db: typeof defaultDb;
  fetchOrders: typeof defaultFetchOrders;
  decrypt: typeof defaultDecrypt;
}

/**
 * Looks up the existing order by (storeId, platformOrderId), merges it with
 * the incoming Shopify payload via mergeOrderUpdate, and upserts the result.
 * Shared by syncShopifyOrders (below) and the webhook route (Task 10) so the
 * upsert logic exists in exactly one place.
 */
export async function upsertOrderFromShopify(
  db: SyncDeps['db'],
  storeId: string,
  shopifyOrder: ShopifyOrder
): Promise<void> {
  const platformOrderId = String(shopifyOrder.id);
  const [existing] = await db
    .select({ status: orders.status })
    .from(orders)
    .where(eq(orders.platformOrderId, platformOrderId));

  const merged = mergeOrderUpdate(existing ?? null, shopifyOrder, storeId);

  await db
    .insert(orders)
    .values(merged)
    .onConflictDoUpdate({
      target: [orders.storeId, orders.platformOrderId],
      set: { ...merged, syncedAt: new Date() },
    });
}

export async function syncShopifyOrders(storeId: string, overrides: Partial<SyncDeps> = {}): Promise<SyncResult> {
  const deps: SyncDeps = {
    db: overrides.db ?? defaultDb,
    fetchOrders: overrides.fetchOrders ?? defaultFetchOrders,
    decrypt: overrides.decrypt ?? defaultDecrypt,
  };
  const { db, fetchOrders, decrypt } = deps;

  const [store] = await db.select().from(stores).where(eq(stores.id, storeId));
  if (!store) {
    return { synced: 0, failed: true, error: 'Store not found' };
  }

  try {
    const accessToken = decrypt(store.accessToken);
    const updatedAtMin = store.lastSyncedAt ? store.lastSyncedAt.toISOString() : undefined;
    const shopifyOrders = await fetchOrders(store.shopDomain, accessToken, updatedAtMin);

    for (const shopifyOrder of shopifyOrders) {
      await upsertOrderFromShopify(db, storeId, shopifyOrder);
    }

    await db
      .update(stores)
      .set({ lastSyncedAt: new Date(), status: 'connected', lastError: null })
      .where(eq(stores.id, storeId));

    return { synced: shopifyOrders.length, failed: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown sync error';
    await db.update(stores).set({ status: 'error', lastError: message }).where(eq(stores.id, storeId));
    return { synced: 0, failed: true, error: message };
  }
}
