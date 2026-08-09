import { AppShell } from '@/components/app-shell';
import { Card, CardContent } from '@/components/ui/card';
import { PlatformIcon, type Platform } from '@/components/platform-icon';
import { db } from '@/db/client';
import { stores } from '@/db/schema';

// Reads live store data with no dynamic route segment or searchParams to
// trigger dynamic rendering automatically — see src/app/page.tsx for why
// this is required.
export const dynamic = 'force-dynamic';

const PLATFORMS: Array<{ key: Platform; name: string; description: string }> = [
  { key: 'shopify', name: 'Shopify', description: 'Sync orders, sync tracking, and print waybills automatically.' },
  { key: 'tiktok', name: 'TikTok Shop', description: 'Order sync for TikTok Shop sellers.' },
  { key: 'shopee', name: 'Shopee', description: 'Order sync for Shopee sellers.' },
  { key: 'lazada', name: 'Lazada', description: 'Order sync for Lazada sellers.' },
];

export default async function IntegrationsPage() {
  const allStores = await db.select().from(stores);
  const shopifyConnected = allStores.some((store) => store.platform === 'shopify');

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
        <p className="text-sm text-muted-foreground">Connect the marketplaces you sell on.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {PLATFORMS.map((platform) => {
          const isShopify = platform.key === 'shopify';
          const connected = isShopify && shopifyConnected;
          return (
            <Card key={platform.key}>
              <CardContent className="flex items-start gap-4 py-5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-muted p-2.5">
                  <PlatformIcon platform={platform.key} className="h-full w-full" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{platform.name}</p>
                    {isShopify ? (
                      connected ? (
                        <span className="inline-flex items-center rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:border-green-500/20 dark:bg-green-500/10 dark:text-green-300">
                          Connected
                        </span>
                      ) : (
                        <a href="/settings/store" className="text-xs font-medium text-primary hover:underline">
                          Connect
                        </a>
                      )
                    ) : (
                      <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                        Coming soon
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{platform.description}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </AppShell>
  );
}
