import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { appSettings } from '@/db/schema';

const settingsBodySchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  companyLogoUrl: z.string().nullish(),
  companyAddress: z.string().nullish(),
  taxInfo: z.string().nullish(),
  defaultPaperSize: z.enum(['4x6', 'a6', 'a5', 'letter']).optional(),
  defaultCourier: z.string().nullish(),
});

export async function GET() {
  const [settings] = await db.select().from(appSettings).limit(1);
  return NextResponse.json({ settings: settings ?? null });
}

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Parsing rather than casting: unknown keys are stripped (so a request can't
  // reach columns it has no business writing) and a missing companyName is
  // rejected here instead of surfacing as a not-null violation from Postgres.
  const parsed = settingsBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', issues: z.treeifyError(parsed.error) },
      { status: 400 }
    );
  }
  const values = parsed.data;

  const [existing] = await db.select().from(appSettings).limit(1);
  if (existing) {
    await db.update(appSettings).set(values).where(eq(appSettings.id, existing.id));
  } else {
    await db.insert(appSettings).values(values);
  }
  return NextResponse.json({ ok: true });
}
