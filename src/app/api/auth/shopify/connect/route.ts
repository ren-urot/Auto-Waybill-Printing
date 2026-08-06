import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { buildShopifyAuthUrl } from '@/lib/shopify/oauth';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const shop = searchParams.get('shop');
  if (!shop) {
    return NextResponse.json({ error: 'Missing shop parameter' }, { status: 400 });
  }
  const state = randomBytes(16).toString('hex');
  const authUrl = buildShopifyAuthUrl(shop, state);
  const response = NextResponse.redirect(authUrl);
  response.cookies.set('shopify_oauth_state', state, { httpOnly: true, maxAge: 600, path: '/' });
  return response;
}
