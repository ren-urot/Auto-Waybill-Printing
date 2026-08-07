// src/lib/shopify/webhook-verify.test.ts
import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { verifyShopifyWebhook } from './webhook-verify';

describe('verifyShopifyWebhook', () => {
  const secret = 'test-webhook-secret';
  const body = JSON.stringify({ id: 123, order_number: 1 });

  it('accepts a correctly signed payload', () => {
    const hmac = createHmac('sha256', secret).update(body, 'utf8').digest('base64');
    expect(verifyShopifyWebhook(body, hmac, secret)).toBe(true);
  });

  it('rejects a payload with the wrong signature', () => {
    expect(verifyShopifyWebhook(body, 'bogus-signature==', secret)).toBe(false);
  });

  it('rejects a missing signature header', () => {
    expect(verifyShopifyWebhook(body, null, secret)).toBe(false);
  });

  it('rejects everything when the secret is unset, even a signature computed with that empty secret', () => {
    // An attacker who knows SHOPIFY_API_SECRET is missing can compute this
    // themselves — an empty key is still a usable HMAC key.
    const hmacWithEmptySecret = createHmac('sha256', '').update(body, 'utf8').digest('base64');
    expect(verifyShopifyWebhook(body, hmacWithEmptySecret, '')).toBe(false);
  });
});
