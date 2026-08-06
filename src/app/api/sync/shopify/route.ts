import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { stores } from '@/db/schema';
import { syncShopifyOrders } from '@/lib/shopify/sync';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const allStores = await db.select().from(stores);
  const results = await Promise.all(allStores.map((store) => syncShopifyOrders(store.id)));
  return NextResponse.json({ results });
}
