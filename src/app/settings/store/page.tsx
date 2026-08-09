import { AppShell } from '@/components/app-shell';
import { SettingsTabs } from '@/components/settings-tabs';
import { StoreConnectionCard } from '@/components/store-connection-card';
import { db } from '@/db/client';
import { stores } from '@/db/schema';

interface StoreSettingsPageProps {
  searchParams: Promise<{ error?: string; connected?: string }>;
}

export default async function StoreSettingsPage({ searchParams }: StoreSettingsPageProps) {
  const { error } = await searchParams;
  const [store] = await db.select().from(stores).limit(1);

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your company profile and printing defaults.</p>
      </div>
      <SettingsTabs />
      <StoreConnectionCard
        store={
          store
            ? { name: store.name, shopDomain: store.shopDomain, status: store.status, lastError: store.lastError }
            : null
        }
        error={error ?? null}
      />
    </AppShell>
  );
}
