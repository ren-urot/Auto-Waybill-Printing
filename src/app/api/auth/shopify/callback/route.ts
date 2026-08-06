import { NextResponse } from 'next/server';
import { exchangeCodeForToken } from '@/lib/shopify/oauth';
import { encryptToken } from '@/lib/crypto';
import { db } from '@/db/client';
import { stores } from '@/db/schema';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const shop = searchParams.get('shop');
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const cookieState = request.headers
    .get('cookie')
    ?.split('; ')
    .find((c) => c.startsWith('shopify_oauth_state='))
    ?.split('=')[1];

  if (!shop || !code || !state || state !== cookieState) {
    return NextResponse.redirect(
      new URL('/settings/store?error=oauth_state_mismatch', request.url)
    );
  }

  try {
    const accessToken = await exchangeCodeForToken(shop, code);
    const values = {
      name: shop,
      platform: 'shopify',
      shopDomain: shop,
      accessToken: encryptToken(accessToken),
      status: 'connected' as const,
      lastError: null,
    };
    await db
      .insert(stores)
      .values(values)
      .onConflictDoUpdate({ target: stores.shopDomain, set: values });
    return NextResponse.redirect(new URL('/settings/store?connected=1', request.url));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.redirect(
      new URL(`/settings/store?error=${encodeURIComponent(message)}`, request.url)
    );
  }
}
