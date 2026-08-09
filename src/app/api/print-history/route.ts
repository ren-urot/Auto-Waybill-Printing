import { NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { printHistory } from '@/db/schema';
import { markOrdersPrinted } from '@/lib/orders/print-status';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { safeQuery } from '@/lib/db/safe-query';
import { getDemoMode } from '@/lib/demo/mode';
import { MOCK_PRINT_HISTORY } from '@/lib/demo/mock-data';

const printHistoryBodySchema = z.object({
  orderIds: z.array(z.uuid()).min(1),
  paperSize: z.enum(['4x6', 'a6', 'a5', 'letter']),
  documentType: z.enum(['waybill', 'packing_slip']),
});

const MAX_HISTORY_ROWS = 100;

export async function GET() {
  const demoMode = await getDemoMode();

  // TEMPORARY: real Supabase sign-in is skipped while doing frontend-only
  // design review (see src/app/login/page.tsx) — the demo cookie stands in
  // for a real session so this route doesn't 401 on every request.
  if (!demoMode) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const rows = await safeQuery(
    () => db.select().from(printHistory).orderBy(desc(printHistory.printedAt)).limit(MAX_HISTORY_ROWS),
    []
  );

  if (rows.length === 0 && demoMode === 'populated') {
    return NextResponse.json({ printHistory: MOCK_PRINT_HISTORY });
  }

  return NextResponse.json({ printHistory: rows });
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = printHistoryBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', issues: z.treeifyError(parsed.error) },
      { status: 400 }
    );
  }
  const body = parsed.data;

  await db.insert(printHistory).values({
    orderIds: body.orderIds,
    printedBy: user.id,
    paperSize: body.paperSize,
    documentType: body.documentType,
  });

  // Logging the print event without advancing the orders left `status` stuck
  // wherever the sync put it, so nothing ever reached 'printed'.
  await markOrdersPrinted(db, body.orderIds);

  return NextResponse.json({ ok: true });
}
