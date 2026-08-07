import { NextResponse } from 'next/server';
import { syncAllStores } from '@/lib/shopify/sync';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = await syncAllStores();
  return NextResponse.json({ results });
}
