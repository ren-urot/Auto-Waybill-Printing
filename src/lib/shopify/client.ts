export interface ShopifyOrder {
  id: number;
  order_number: number;
  cancelled_at: string | null;
  fulfillment_status: string | null;
  created_at: string;
  updated_at: string;
  note: string | null;
  total_shipping_price_set?: { shop_money?: { amount: string } };
  payment_gateway_names?: string[];
  customer?: { first_name?: string; last_name?: string; phone?: string };
  shipping_address?: {
    address1?: string;
    city?: string;
    province?: string;
    zip?: string;
    country?: string;
    phone?: string;
  };
  line_items: Array<{ sku: string | null; title: string; quantity: number }>;
  fulfillments?: Array<{ tracking_number?: string; tracking_company?: string }>;
}

/**
 * Hard cap on cursor pages followed in one call. 20 pages x 250 orders = 5000
 * orders per sync. Hitting the cap is acceptable for phase 1 (the next sync
 * picks up where this one stopped, because `lastSyncedAt` only advances past
 * orders we actually processed) — the point is to never loop forever if
 * Shopify keeps handing back a `next` link.
 */
const MAX_PAGES = 20;

/**
 * Parses a Shopify `Link` response header and returns the URL for `rel="next"`.
 *
 * Shopify's format (RFC 5988) looks like:
 *   <https://shop/admin/api/…/orders.json?page_info=abc>; rel="previous", <https://…?page_info=xyz>; rel="next"
 *
 * Both `previous` and `next` can appear in the same header — only `next` is
 * followed here; following `previous` would walk backwards forever.
 */
export function parseNextPageUrl(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  for (const part of linkHeader.split(',')) {
    const match = part.match(/<([^>]+)>\s*;\s*rel\s*=\s*"?([^";]+)"?/);
    if (match && match[2].trim() === 'next') {
      return match[1].trim();
    }
  }
  return null;
}

interface OrdersPage {
  orders: ShopifyOrder[];
  nextUrl: string | null;
}

async function fetchOrdersPage(url: string | URL, accessToken: string): Promise<OrdersPage> {
  const maxRetries = 3;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const response = await fetch(url, {
      headers: { 'X-Shopify-Access-Token': accessToken },
    });
    if (response.status === 429 && attempt < maxRetries) {
      const retryAfterSeconds = Number(response.headers.get('retry-after')) || 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, retryAfterSeconds * 1000));
      continue;
    }
    if (!response.ok) {
      throw new Error(`Shopify orders fetch failed: ${response.status}`);
    }
    const data = (await response.json()) as { orders: ShopifyOrder[] };
    return {
      orders: data.orders ?? [],
      nextUrl: parseNextPageUrl(response.headers.get('link') ?? response.headers.get('Link')),
    };
  }
  throw new Error('Shopify orders fetch failed: exhausted retries after repeated 429 responses');
}

export async function fetchShopifyOrders(
  shopDomain: string,
  accessToken: string,
  updatedAtMin?: string
): Promise<ShopifyOrder[]> {
  const firstUrl = new URL(`https://${shopDomain}/admin/api/2024-10/orders.json`);
  firstUrl.searchParams.set('status', 'any');
  firstUrl.searchParams.set('limit', '250');
  if (updatedAtMin) {
    firstUrl.searchParams.set('updated_at_min', updatedAtMin);
  }

  const all: ShopifyOrder[] = [];
  // `next` links already carry status/limit/updated_at_min encoded in the
  // page_info cursor, so they're followed verbatim rather than rebuilt.
  let nextUrl: string | URL | null = firstUrl;
  for (let page = 0; page < MAX_PAGES && nextUrl; page += 1) {
    const result: OrdersPage = await fetchOrdersPage(nextUrl, accessToken);
    all.push(...result.orders);
    nextUrl = result.nextUrl;
  }
  return all;
}
