import { NextResponse } from 'next/server';
import { syncAllStores } from '@/lib/shopify/sync';
import { isAuthorizedCronRequest } from '@/lib/cron/auth';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!isAuthorizedCronRequest(authHeader, process.env.CRON_SECRET ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = await syncAllStores();
  return NextResponse.json({ results });
}
