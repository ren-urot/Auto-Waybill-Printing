import { and, inArray, notInArray } from 'drizzle-orm';
import type { db as defaultDb } from '@/db/client';
import { orders } from '@/db/schema';

/**
 * Statuses that must never be walked back to 'printed'. Both are terminal
 * facts reported by Shopify — reprinting a waybill for an order that already
 * shipped shouldn't un-ship it.
 */
const TERMINAL_STATUSES = ['shipped', 'cancelled'];

/**
 * Advances every listed order to 'printed', skipping any that are already in a
 * terminal state. This is the only place `orders.status = 'printed'` is ever
 * written — before this existed the dashboard's "Printed" tile was pinned at 0
 * no matter how much was printed.
 *
 * Applies to both waybills and packing slips: phase 1 has no separate
 * "mark as packed" action, so 'printed' is the only local advance available.
 */
export async function markOrdersPrinted(
  db: typeof defaultDb,
  orderIds: string[]
): Promise<void> {
  if (orderIds.length === 0) return;
  await db
    .update(orders)
    .set({ status: 'printed' })
    .where(and(inArray(orders.id, orderIds), notInArray(orders.status, TERMINAL_STATUSES)));
}
