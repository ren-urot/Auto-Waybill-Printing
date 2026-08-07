import { describe, it, expect } from 'vitest';
import { mergeOrderUpdate } from './merge';
import type { ShopifyOrder } from './client';

function baseShopifyOrder(overrides: Partial<ShopifyOrder> = {}): ShopifyOrder {
  return {
    id: 1001,
    order_number: 1,
    cancelled_at: null,
    fulfillment_status: null,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    note: null,
    customer: { first_name: 'Ana', last_name: 'Cruz', phone: '0917' },
    shipping_address: { address1: '123 Rd', city: 'Manila', province: 'NCR', zip: '1000', country: 'PH' },
    line_items: [{ sku: 'SKU1', title: 'Shirt', quantity: 2 }],
    fulfillments: [],
    ...overrides,
  };
}

describe('mergeOrderUpdate', () => {
  it('maps a new unfulfilled order to ready_to_ship', () => {
    const result = mergeOrderUpdate(null, baseShopifyOrder(), 'store-1');
    expect(result.status).toBe('ready_to_ship');
    expect(result.customerName).toBe('Ana Cruz');
    expect(result.storeId).toBe('store-1');
  });

  it('maps a cancelled order to cancelled regardless of prior local status', () => {
    const shopifyOrder = baseShopifyOrder({ cancelled_at: '2026-08-02T00:00:00Z' });
    const result = mergeOrderUpdate({ status: 'printed' }, shopifyOrder, 'store-1');
    expect(result.status).toBe('cancelled');
  });

  it('maps a fulfilled order to shipped regardless of prior local status', () => {
    const shopifyOrder = baseShopifyOrder({ fulfillment_status: 'fulfilled' });
    const result = mergeOrderUpdate({ status: 'printed' }, shopifyOrder, 'store-1');
    expect(result.status).toBe('shipped');
  });

  it('preserves a locally-advanced status (printed) when Shopify still reports unfulfilled', () => {
    const result = mergeOrderUpdate({ status: 'printed' }, baseShopifyOrder(), 'store-1');
    expect(result.status).toBe('printed');
  });

  it('preserves a locally-advanced status (packed) when Shopify still reports unfulfilled', () => {
    const result = mergeOrderUpdate({ status: 'packed' }, baseShopifyOrder(), 'store-1');
    expect(result.status).toBe('packed');
  });

  it('does not preserve a non-advanced local status (pending) and takes the derived value', () => {
    const result = mergeOrderUpdate({ status: 'pending' }, baseShopifyOrder(), 'store-1');
    expect(result.status).toBe('ready_to_ship');
  });

  describe('hostile / partial payloads', () => {
    it('treats a payload with no line_items as an empty item list instead of throwing', () => {
      const shopifyOrder = baseShopifyOrder();
      delete (shopifyOrder as Partial<ShopifyOrder>).line_items;

      expect(() => mergeOrderUpdate(null, shopifyOrder, 'store-1')).not.toThrow();
      expect(mergeOrderUpdate(null, shopifyOrder, 'store-1').items).toEqual([]);
    });

    it('normalises a missing note to null, not undefined', () => {
      const shopifyOrder = baseShopifyOrder();
      delete (shopifyOrder as Partial<ShopifyOrder>).note;

      const result = mergeOrderUpdate(null, shopifyOrder, 'store-1');
      // Drizzle drops undefined keys from onConflictDoUpdate's SET clause, so
      // undefined here would mean a note cleared in Shopify never clears
      // locally.
      expect(result.notes).toBeNull();
      expect(result.notes).not.toBeUndefined();
    });

    it('keeps an explicit null note as null', () => {
      expect(mergeOrderUpdate(null, baseShopifyOrder({ note: null }), 'store-1').notes).toBeNull();
    });

    it('survives a payload with no shipping_address, customer, or fulfillments', () => {
      const shopifyOrder = baseShopifyOrder();
      delete (shopifyOrder as Partial<ShopifyOrder>).shipping_address;
      delete (shopifyOrder as Partial<ShopifyOrder>).customer;
      delete (shopifyOrder as Partial<ShopifyOrder>).fulfillments;

      const result = mergeOrderUpdate(null, shopifyOrder, 'store-1');
      expect(result.customerName).toBe('Unknown customer');
      expect(result.address).toEqual({});
      expect(result.phone).toBeNull();
      expect(result.courier).toBeNull();
      expect(result.trackingNumber).toBeNull();
    });
  });
});
