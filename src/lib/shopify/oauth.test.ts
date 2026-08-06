import { describe, it, expect, beforeAll } from 'vitest';
import { buildShopifyAuthUrl } from './oauth';

beforeAll(() => {
  process.env.SHOPIFY_API_KEY = 'test-api-key';
  process.env.SHOPIFY_APP_URL = 'https://omniship.example.com';
});

describe('buildShopifyAuthUrl', () => {
  it('builds a valid Shopify OAuth authorize URL', () => {
    const url = buildShopifyAuthUrl('my-shop.myshopify.com', 'state-123');
    const parsed = new URL(url);
    expect(parsed.origin).toBe('https://my-shop.myshopify.com');
    expect(parsed.pathname).toBe('/admin/oauth/authorize');
    expect(parsed.searchParams.get('client_id')).toBe('test-api-key');
    expect(parsed.searchParams.get('scope')).toBe('read_orders');
    expect(parsed.searchParams.get('state')).toBe('state-123');
    expect(parsed.searchParams.get('redirect_uri')).toBe(
      'https://omniship.example.com/api/auth/shopify/callback'
    );
  });

  it('rejects a shop domain that is not a myshopify.com host', () => {
    expect(() => buildShopifyAuthUrl('not-a-shop-domain', 'state-123')).toThrow();
  });
});
