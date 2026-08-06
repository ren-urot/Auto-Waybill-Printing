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

export async function fetchShopifyOrders(
  shopDomain: string,
  accessToken: string,
  updatedAtMin?: string
): Promise<ShopifyOrder[]> {
  const url = new URL(`https://${shopDomain}/admin/api/2024-10/orders.json`);
  url.searchParams.set('status', 'any');
  url.searchParams.set('limit', '250');
  if (updatedAtMin) {
    url.searchParams.set('updated_at_min', updatedAtMin);
  }
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
    return data.orders;
  }
  throw new Error('Shopify orders fetch failed: exhausted retries after repeated 429 responses');
}
