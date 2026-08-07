import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchShopifyOrders, parseNextPageUrl, type ShopifyOrder } from './client';

function order(id: number): ShopifyOrder {
  return {
    id,
    order_number: id,
    cancelled_at: null,
    fulfillment_status: null,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    note: null,
    line_items: [],
  };
}

function pageResponse(orders: ShopifyOrder[], linkHeader?: string) {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (linkHeader) headers.set('link', linkHeader);
  return new Response(JSON.stringify({ orders }), { status: 200, headers });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('parseNextPageUrl', () => {
  it('returns null when there is no Link header', () => {
    expect(parseNextPageUrl(null)).toBeNull();
    expect(parseNextPageUrl('')).toBeNull();
  });

  it('extracts the rel="next" url', () => {
    const header = '<https://shop.myshopify.com/admin/api/2024-10/orders.json?page_info=NEXT>; rel="next"';
    expect(parseNextPageUrl(header)).toBe(
      'https://shop.myshopify.com/admin/api/2024-10/orders.json?page_info=NEXT'
    );
  });

  it('ignores rel="previous" and only follows rel="next"', () => {
    const header =
      '<https://shop.myshopify.com/x?page_info=PREV>; rel="previous", <https://shop.myshopify.com/x?page_info=NEXT>; rel="next"';
    expect(parseNextPageUrl(header)).toBe('https://shop.myshopify.com/x?page_info=NEXT');
  });

  it('returns null when only a previous link is present (last page)', () => {
    const header = '<https://shop.myshopify.com/x?page_info=PREV>; rel="previous"';
    expect(parseNextPageUrl(header)).toBeNull();
  });
});

describe('fetchShopifyOrders', () => {
  it('returns the single page when there is no next link', async () => {
    const fetchMock = vi.fn().mockResolvedValue(pageResponse([order(1), order(2)]));
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchShopifyOrders('shop.myshopify.com', 'token');

    expect(result.map((o) => o.id)).toEqual([1, 2]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('follows Link rel="next" and accumulates every page', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(pageResponse([order(1)], '<https://shop/x?page_info=P2>; rel="next"'))
      .mockResolvedValueOnce(
        pageResponse(
          [order(2)],
          '<https://shop/x?page_info=P1>; rel="previous", <https://shop/x?page_info=P3>; rel="next"'
        )
      )
      .mockResolvedValueOnce(pageResponse([order(3)], '<https://shop/x?page_info=P2>; rel="previous"'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchShopifyOrders('shop.myshopify.com', 'token');

    expect(result.map((o) => o.id)).toEqual([1, 2, 3]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[1][0])).toBe('https://shop/x?page_info=P2');
    expect(String(fetchMock.mock.calls[2][0])).toBe('https://shop/x?page_info=P3');
  });

  it('stops at the page cap instead of looping forever', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(async () => pageResponse([order(1)], '<https://shop/x?page_info=SAME>; rel="next"'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchShopifyOrders('shop.myshopify.com', 'token');

    expect(fetchMock).toHaveBeenCalledTimes(20);
    expect(result).toHaveLength(20);
  });

  it('sends updated_at_min on the first request only', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(pageResponse([order(1)], '<https://shop/x?page_info=P2>; rel="next"'))
      .mockResolvedValueOnce(pageResponse([order(2)]));
    vi.stubGlobal('fetch', fetchMock);

    await fetchShopifyOrders('shop.myshopify.com', 'token', '2026-08-01T00:00:00.000Z');

    expect(String(fetchMock.mock.calls[0][0])).toContain('updated_at_min=2026-08-01T00%3A00%3A00.000Z');
    expect(String(fetchMock.mock.calls[1][0])).toBe('https://shop/x?page_info=P2');
  });

  it('throws on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 401 })));
    await expect(fetchShopifyOrders('shop.myshopify.com', 'token')).rejects.toThrow(
      'Shopify orders fetch failed: 401'
    );
  });
});
