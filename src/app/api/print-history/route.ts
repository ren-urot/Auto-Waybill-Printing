import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { printHistory } from '@/db/schema';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as {
    orderIds: string[];
    paperSize: string;
    documentType: 'waybill' | 'packing_slip';
  };

  await db.insert(printHistory).values({
    orderIds: body.orderIds,
    printedBy: user.id,
    paperSize: body.paperSize,
    documentType: body.documentType,
  });

  return NextResponse.json({ ok: true });
}
