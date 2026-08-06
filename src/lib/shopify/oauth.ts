const SHOP_DOMAIN_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;

export function buildShopifyAuthUrl(shop: string, state: string): string {
  if (!SHOP_DOMAIN_PATTERN.test(shop)) {
    throw new Error(`Invalid Shopify shop domain: ${shop}`);
  }
  const apiKey = process.env.SHOPIFY_API_KEY;
  const appUrl = process.env.SHOPIFY_APP_URL;
  if (!apiKey || !appUrl) {
    throw new Error('SHOPIFY_API_KEY or SHOPIFY_APP_URL is not set');
  }
  const url = new URL(`https://${shop}/admin/oauth/authorize`);
  url.searchParams.set('client_id', apiKey);
  url.searchParams.set('scope', 'read_orders');
  url.searchParams.set('redirect_uri', `${appUrl}/api/auth/shopify/callback`);
  url.searchParams.set('state', state);
  return url.toString();
}

export async function exchangeCodeForToken(shop: string, code: string): Promise<string> {
  if (!SHOP_DOMAIN_PATTERN.test(shop)) {
    throw new Error(`Invalid Shopify shop domain: ${shop}`);
  }
  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.SHOPIFY_API_KEY,
      client_secret: process.env.SHOPIFY_API_SECRET,
      code,
    }),
  });
  if (!response.ok) {
    throw new Error(`Shopify token exchange failed: ${response.status}`);
  }
  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}
