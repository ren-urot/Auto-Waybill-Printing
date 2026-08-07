import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { appSettings } from '@/db/schema';

export async function GET() {
  const [settings] = await db.select().from(appSettings).limit(1);
  return NextResponse.json({ settings: settings ?? null });
}

export async function POST(request: Request) {
  const body = await request.json();
  const [existing] = await db.select().from(appSettings).limit(1);
  if (existing) {
    await db.update(appSettings).set(body);
  } else {
    await db.insert(appSettings).values(body);
  }
  return NextResponse.json({ ok: true });
}
