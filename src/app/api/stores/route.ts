import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db/client';
import { stores } from '@/db/schema';

// Only the platforms without a real OAuth flow (see /api/auth/shopify/connect
// for Shopify's) — this route exists so Integrations can demo connecting a
// marketplace before TikTok Shop/Shopee/Lazada API partnerships are in place.
const connectBodySchema = z.object({
  platform: z.enum(['tiktok', 'shopee', 'lazada']),
});

const PLATFORM_NAMES: Record<string, string> = {
  tiktok: 'TikTok Shop',
  shopee: 'Shopee',
  lazada: 'Lazada',
};

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = connectBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', issues: z.treeifyError(parsed.error) },
      { status: 400 }
    );
  }
  const { platform } = parsed.data;

  // No real marketplace API partnership exists yet for these platforms, so
  // there's nothing to actually authenticate against — this creates a
  // genuinely persisted store row (shows up on Dashboard/Stores/Orders like
  // any other store) without pretending an OAuth handshake happened.
  const [store] = await db
    .insert(stores)
    .values({
      name: `${PLATFORM_NAMES[platform]} Store`,
      platform,
      shopDomain: `demo-${platform}-${Date.now()}.${platform}.local`,
      accessToken: 'demo-connect-token',
      status: 'connected',
      lastSyncedAt: new Date(),
    })
    .returning();

  return NextResponse.json({ store });
}
