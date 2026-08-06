import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { stores } from '@/db/schema';
import { syncShopifyOrders } from '@/lib/shopify/sync';
import { isAuthorizedCronRequest } from '@/lib/cron/auth';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!isAuthorizedCronRequest(authHeader, process.env.CRON_SECRET ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const allStores = await db.select().from(stores);
  const results = await Promise.all(allStores.map((store) => syncShopifyOrders(store.id)));
  return NextResponse.json({ results });
}
