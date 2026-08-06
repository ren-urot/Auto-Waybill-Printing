// src/lib/shopify/webhook-verify.ts
import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifyShopifyWebhook(rawBody: string, hmacHeader: string | null, secret: string): boolean {
  if (!hmacHeader) return false;
  const digest = createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
  const digestBuffer = Buffer.from(digest);
  const headerBuffer = Buffer.from(hmacHeader);
  if (digestBuffer.length !== headerBuffer.length) return false;
  return timingSafeEqual(digestBuffer, headerBuffer);
}
