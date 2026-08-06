# OmniShip Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-tenant Next.js PWA that connects one Shopify store, syncs its orders, and lets one authenticated user browse/filter orders and print waybills + packing slips (with barcode/QR) via the browser print dialog.

**Architecture:** Next.js 15 App Router serves both the UI and the API (Route Handlers). Supabase provides Postgres (via Drizzle ORM) and Auth. Shopify orders arrive via OAuth-authenticated polling (Vercel Cron, every 5 min), webhooks (HMAC-verified, real-time), and a manual "Sync Now" button — all three call the same sync function. Waybills/packing slips render as print-optimized HTML with client-drawn barcodes/QR codes; "printing" is the browser's native print dialog (supports Save-as-PDF). No queue/worker infrastructure.

**Tech Stack:** Next.js 15, React 19, TypeScript 5, Tailwind CSS v4, shadcn/ui (`base-nova` style, `neutral` base, `lucide` icons), Geist Sans/Mono, Drizzle ORM + `postgres`, Supabase (`@supabase/supabase-js`, `@supabase/ssr`), `jsbarcode`, `qrcode`, `zod`, `sonner`, Vitest + Testing Library.

## Global Constraints

- Brand primary color: `#f05223` (light mode) / `#f56a41` (dark mode) — exact values, do not approximate.
- Border radius: `0.625rem` across shadcn theme tokens.
- shadcn/ui config: `style: "base-nova"`, `baseColor: "neutral"`, `iconLibrary: "lucide"`.
- Fonts: Geist Sans for UI text, Geist Mono for tracking numbers/order numbers/codes.
- No Redis/BullMQ/job queue — sync runs as plain Route Handlers + Vercel Cron only.
- No RBAC/roles tables and no multi-store UI in phase 1 — schema allows more than one `stores` row, but there is no "add another store" UI yet.
- Printing goes through `window.print()` on server-rendered/client-rendered HTML — no server-side PDF engine, no Puppeteer, no hardware printer SDKs.
- Shopify `access_token` must never be stored in plaintext — always pass through `encryptToken`/`decryptToken` (Task 4).
- Every Shopify-facing or webhook-facing route must authenticate its caller (cron secret, HMAC signature, or Supabase session) before touching the database.

---

## Task 1: Project Scaffold, Brand Theme, Test Runner

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `vitest.config.ts`, `.env.example`, `.gitignore`
- Create: `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`
- Test: `src/lib/sanity.test.ts`

**Interfaces:**
- Produces: Tailwind v4 theme tokens (`--primary`, `--background`, `--radius`, etc.) available globally via `globals.css`; Geist fonts exposed as CSS variables `--font-geist-sans` / `--font-geist-mono` on `<html>`.

- [ ] **Step 1: Scaffold the Next.js app**

```bash
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir=false --import-alias "@/*" --eslint --use-npm
```

When prompted, accept defaults. This creates `package.json`, `next.config.ts`, `tsconfig.json`, `src/app/*`.

- [ ] **Step 2: Install core dependencies**

```bash
npm install drizzle-orm postgres @supabase/supabase-js @supabase/ssr zod sonner jsbarcode qrcode geist
npm install -D drizzle-kit vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @types/qrcode
```

- [ ] **Step 3: Configure Vitest**

Create `vitest.config.ts`:

```ts
import { defineConfig, configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    // *.integration.test.ts files hit a real Postgres and run via the
    // separate `test:integration` config (Task 12) — excluded here so
    // plain `npm test` stays fast, deterministic, and DB-independent.
    exclude: [...configDefaults.exclude, '**/*.integration.test.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
```

Create `vitest.setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

Add to `package.json` scripts: `"test": "vitest run"`, `"test:watch": "vitest"`.

- [ ] **Step 4: Write the sanity test**

```ts
// src/lib/sanity.test.ts
import { describe, it, expect } from 'vitest';

describe('project scaffold', () => {
  it('runs a basic assertion', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test`
Expected: 1 test passes.

- [ ] **Step 6: Set brand theme tokens in globals.css**

Replace the generated `src/app/globals.css` with:

```css
@import "tailwindcss";

@theme inline {
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
  --radius: 0.625rem;
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
}

:root {
  --background: oklch(0.98 0 0);
  --foreground: oklch(0.18 0 0);
  --primary: #f05223;
  --primary-foreground: oklch(0.98 0 0);
}

:root[data-theme="dark"] {
  --background: oklch(0.16 0 0);
  --foreground: oklch(0.95 0 0);
  --primary: #f56a41;
  --primary-foreground: oklch(0.16 0 0);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --background: oklch(0.16 0 0);
    --foreground: oklch(0.95 0 0);
    --primary: #f56a41;
    --primary-foreground: oklch(0.16 0 0);
  }
}

body {
  background: var(--background);
  color: var(--foreground);
}
```

- [ ] **Step 7: Wire Geist fonts in the root layout**

```tsx
// src/app/layout.tsx
import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';

export const metadata: Metadata = {
  title: 'OmniShip',
  description: 'Automated waybill printing for Shopify orders',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 8: Verify the build succeeds**

Run: `npm run build`
Expected: build completes with no errors.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with brand theme and test runner"
```

---

## Task 2: shadcn/ui Setup + App Shell

**Files:**
- Create: `components.json`
- Create: `src/components/ui/*` (generated by shadcn CLI: `button`, `card`, `table`, `badge`, `input`, `select`, `dialog`, `sonner`, `separator`, `skeleton`)
- Create: `src/components/app-shell.tsx`
- Modify: `src/app/layout.tsx` (add `<Toaster />`)
- Test: `src/components/app-shell.test.tsx`

**Interfaces:**
- Consumes: Tailwind theme tokens from Task 1 (`globals.css`).
- Produces: `AppShell` component — `<AppShell>{children}</AppShell>` — renders a left nav (Dashboard, Orders, Settings) and a header; used by every authenticated page in later tasks.

- [ ] **Step 1: Initialize shadcn/ui**

```bash
npx shadcn@latest init
```

Answer prompts: style `base-nova`, base color `neutral`, CSS variables yes, icon library `lucide`. This writes `components.json`.

- [ ] **Step 2: Add base components**

```bash
npx shadcn@latest add button card table badge input select dialog sonner separator skeleton
```

- [ ] **Step 3: Write the failing test for AppShell**

```tsx
// src/components/app-shell.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AppShell } from './app-shell';

describe('AppShell', () => {
  it('renders nav links and children', () => {
    render(
      <AppShell>
        <p>page content</p>
      </AppShell>
    );
    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /orders/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /settings/i })).toBeInTheDocument();
    expect(screen.getByText('page content')).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npm test -- app-shell`
Expected: FAIL — `Cannot find module './app-shell'`.

- [ ] **Step 5: Implement AppShell**

```tsx
// src/components/app-shell.tsx
import Link from 'next/link';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <nav className="w-56 shrink-0 border-r p-4 space-y-2">
        <div className="font-mono font-semibold text-lg mb-6">OmniShip</div>
        <Link href="/" className="block rounded-md px-3 py-2 text-sm hover:bg-accent">
          Dashboard
        </Link>
        <Link href="/orders" className="block rounded-md px-3 py-2 text-sm hover:bg-accent">
          Orders
        </Link>
        <Link href="/settings" className="block rounded-md px-3 py-2 text-sm hover:bg-accent">
          Settings
        </Link>
      </nav>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- app-shell`
Expected: PASS.

- [ ] **Step 7: Add the Toaster to the root layout**

```tsx
// src/app/layout.tsx  (add inside <body>, after {children})
import { Toaster } from '@/components/ui/sonner';
// ...
<body>
  {children}
  <Toaster />
</body>
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add shadcn/ui setup and app shell nav"
```

---

## Task 3: Database Schema + Drizzle + Supabase Postgres Connection

**Files:**
- Create: `src/db/schema.ts`, `src/db/client.ts`, `drizzle.config.ts`
- Modify: `.env.example` (add `DATABASE_URL`, `DATABASE_URL_TEST`)
- Test: none (schema is verified via migration + Task 4/7 integration tests using it)

**Interfaces:**
- Produces: `db` (Drizzle client) and table objects `stores`, `orders`, `printHistory`, `appSettings` from `@/db/schema`, used by every DB-touching task from here on.

- [ ] **Step 1: Define the schema**

```ts
// src/db/schema.ts
import { pgTable, uuid, text, timestamp, jsonb, numeric, uniqueIndex } from 'drizzle-orm/pg-core';

export const stores = pgTable(
  'stores',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    platform: text('platform').notNull().default('shopify'),
    shopDomain: text('shop_domain').notNull(),
    accessToken: text('access_token').notNull(),
    status: text('status').notNull().default('connected'),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('stores_shop_domain_idx').on(table.shopDomain)]
);

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storeId: uuid('store_id').notNull().references(() => stores.id),
    platformOrderId: text('platform_order_id').notNull(),
    orderNumber: text('order_number').notNull(),
    customerName: text('customer_name').notNull(),
    phone: text('phone'),
    address: jsonb('address').notNull(),
    items: jsonb('items').notNull(),
    courier: text('courier'),
    trackingNumber: text('tracking_number'),
    shippingFee: numeric('shipping_fee'),
    paymentMethod: text('payment_method'),
    status: text('status').notNull().default('pending'),
    notes: text('notes'),
    rawPayload: jsonb('raw_payload'),
    syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('orders_store_platform_order_idx').on(table.storeId, table.platformOrderId),
  ]
);

export const printHistory = pgTable('print_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderIds: jsonb('order_ids').notNull().$type<string[]>(),
  printedBy: text('printed_by').notNull(),
  paperSize: text('paper_size').notNull(),
  documentType: text('document_type').notNull(),
  printedAt: timestamp('printed_at', { withTimezone: true }).notNull().defaultNow(),
});

export const appSettings = pgTable('app_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  companyName: text('company_name').notNull(),
  companyLogoUrl: text('company_logo_url'),
  companyAddress: text('company_address'),
  taxInfo: text('tax_info'),
  defaultPaperSize: text('default_paper_size').notNull().default('4x6'),
  defaultCourier: text('default_courier'),
});
```

- [ ] **Step 2: Create the Drizzle client**

```ts
// src/db/client.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const queryClient = postgres(connectionString);
export const db = drizzle(queryClient, { schema });
```

- [ ] **Step 3: Configure drizzle-kit**

```ts
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

Add to `.env.example`:

```
DATABASE_URL=postgres://postgres:postgres@localhost:5432/omniship
DATABASE_URL_TEST=postgres://postgres:test@localhost:5433/omniship_test
```

Add to `package.json` scripts: `"db:generate": "drizzle-kit generate"`, `"db:migrate": "drizzle-kit migrate"`.

- [ ] **Step 4: Generate the initial migration**

Run: `npm run db:generate`
Expected: a new SQL file appears under `src/db/migrations/`.

- [ ] **Step 5: Start a local Postgres and apply the migration**

```bash
docker run --rm -d --name omniship-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=omniship -p 5432:5432 postgres:16
npm run db:migrate
```

Expected: migration applies with no errors (verify with `docker exec omniship-db psql -U postgres -d omniship -c '\dt'` showing all four tables).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add Drizzle schema and Postgres connection"
```

---

## Task 4: Shopify Access Token Encryption

**Files:**
- Create: `src/lib/crypto.ts`
- Test: `src/lib/crypto.test.ts`

**Interfaces:**
- Produces: `encryptToken(plaintext: string): string`, `decryptToken(ciphertext: string): string` — used by Task 6 (OAuth callback) and Task 7 (Shopify client) whenever `stores.accessToken` is written or read.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/crypto.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { encryptToken, decryptToken } from './crypto';

beforeAll(() => {
  process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
});

describe('token encryption', () => {
  it('round-trips a plaintext token', () => {
    const ciphertext = encryptToken('shpat_secret_value');
    expect(ciphertext).not.toContain('shpat_secret_value');
    expect(decryptToken(ciphertext)).toBe('shpat_secret_value');
  });

  it('produces different ciphertext for the same plaintext each call', () => {
    const a = encryptToken('same-value');
    const b = encryptToken('same-value');
    expect(a).not.toBe(b);
  });

  it('throws on malformed ciphertext', () => {
    expect(() => decryptToken('not-valid')).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- crypto`
Expected: FAIL — `Cannot find module './crypto'`.

- [ ] **Step 3: Implement encryptToken/decryptToken**

```ts
// src/lib/crypto.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';

function getKey(): Buffer {
  const keyBase64 = process.env.TOKEN_ENCRYPTION_KEY;
  if (!keyBase64) {
    throw new Error('TOKEN_ENCRYPTION_KEY is not set');
  }
  const key = Buffer.from(keyBase64, 'base64');
  if (key.length !== 32) {
    throw new Error('TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes');
  }
  return key;
}

export function encryptToken(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join(':');
}

export function decryptToken(ciphertext: string): string {
  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('Malformed ciphertext');
  }
  const [ivB64, tagB64, dataB64] = parts;
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- crypto`
Expected: 3 tests pass.

- [ ] **Step 5: Add TOKEN_ENCRYPTION_KEY to .env.example**

```
TOKEN_ENCRYPTION_KEY=replace-with-openssl-rand-base64-32-output
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add AES-256-GCM encryption for Shopify access tokens"
```

---

## Task 5: Supabase Auth — Login Page + Session Middleware

**Files:**
- Create: `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`
- Create: `src/app/login/page.tsx`
- Create: `src/proxy.ts` (Next.js 16's renamed `middleware.ts` convention — see Step 5)
- Modify: `.env.example` (add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)

**Interfaces:**
- Produces: `createSupabaseServerClient()` (async, for Server Components/Route Handlers) and `createSupabaseBrowserClient()` (for Client Components), used by every authenticated page/route from here on.

- [ ] **Step 1: Add Supabase env vars**

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

- [ ] **Step 2: Create the server Supabase client**

```ts
// src/lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        },
      },
    }
  );
}
```

- [ ] **Step 3: Create the browser Supabase client**

```ts
// src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr';

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 4: Build the login page**

```tsx
// src/app/login/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(signInError.message);
      return;
    }
    router.push('/');
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="font-mono">OmniShip</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full">
              Sign in
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 5: Add session-refresh + route-protection proxy (Next.js 16's renamed middleware)**

Next.js 16 deprecated the `middleware.ts` file convention and renamed it to `proxy.ts` (file name and exported function name both change; behavior is identical). A `middleware.ts` with `export function middleware()` builds without error but **never executes** on Next.js 16 — use `proxy.ts` with `export function proxy()`. For a project using the `src/app` layout (this project, since Task 1), the file must live at **`src/proxy.ts`**, not the project root — a root-level `proxy.ts` builds silently but is never registered or invoked for `src`-layout projects on this Next.js version.

```ts
// src/proxy.ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublicPath =
    path.startsWith('/login') || path.startsWith('/api/cron') || path.startsWith('/api/webhooks');

  if (!user && !isPublicPath) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

- [ ] **Step 6: Manual verification**

Run: `npm run dev`, visit `/`. Expected: redirected to `/login` (no Supabase project configured yet is fine — the redirect logic itself is what's being verified structurally; full sign-in is verified once a real Supabase project is connected, per the Open Prerequisites in the design spec). Confirm the redirect actually happens — an unredirected 200 means the proxy isn't running (e.g. wrong file name/export for the installed Next.js version) and must be fixed before moving on, since every later authenticated page/route depends on this.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add Supabase auth login page and session proxy"
```

---

## Task 6: Shopify OAuth Connect + Callback

**Files:**
- Create: `src/lib/shopify/oauth.ts`
- Create: `src/app/api/auth/shopify/connect/route.ts`
- Create: `src/app/api/auth/shopify/callback/route.ts`
- Test: `src/lib/shopify/oauth.test.ts`

**Interfaces:**
- Consumes: `encryptToken` from Task 4 (`@/lib/crypto`), `db`/`stores` from Task 3 (`@/db/client`, `@/db/schema`).
- Produces: `buildShopifyAuthUrl(shop: string, state: string): string`, `exchangeCodeForToken(shop: string, code: string): Promise<string>` — used only within this task's routes, but exported for testability.

- [ ] **Step 1: Write the failing test for buildShopifyAuthUrl**

```ts
// src/lib/shopify/oauth.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { buildShopifyAuthUrl } from './oauth';

beforeAll(() => {
  process.env.SHOPIFY_API_KEY = 'test-api-key';
  process.env.SHOPIFY_APP_URL = 'https://omniship.example.com';
});

describe('buildShopifyAuthUrl', () => {
  it('builds a valid Shopify OAuth authorize URL', () => {
    const url = buildShopifyAuthUrl('my-shop.myshopify.com', 'state-123');
    const parsed = new URL(url);
    expect(parsed.origin).toBe('https://my-shop.myshopify.com');
    expect(parsed.pathname).toBe('/admin/oauth/authorize');
    expect(parsed.searchParams.get('client_id')).toBe('test-api-key');
    expect(parsed.searchParams.get('scope')).toBe('read_orders');
    expect(parsed.searchParams.get('state')).toBe('state-123');
    expect(parsed.searchParams.get('redirect_uri')).toBe(
      'https://omniship.example.com/api/auth/shopify/callback'
    );
  });

  it('rejects a shop domain that is not a myshopify.com host', () => {
    expect(() => buildShopifyAuthUrl('not-a-shop-domain', 'state-123')).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- oauth`
Expected: FAIL — `Cannot find module './oauth'`.

- [ ] **Step 3: Implement oauth.ts**

```ts
// src/lib/shopify/oauth.ts
const SHOP_DOMAIN_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;

export function buildShopifyAuthUrl(shop: string, state: string): string {
  if (!SHOP_DOMAIN_PATTERN.test(shop)) {
    throw new Error(`Invalid Shopify shop domain: ${shop}`);
  }
  const apiKey = process.env.SHOPIFY_API_KEY;
  const appUrl = process.env.SHOPIFY_APP_URL;
  if (!apiKey || !appUrl) {
    throw new Error('SHOPIFY_API_KEY or SHOPIFY_APP_URL is not set');
  }
  const url = new URL(`https://${shop}/admin/oauth/authorize`);
  url.searchParams.set('client_id', apiKey);
  url.searchParams.set('scope', 'read_orders');
  url.searchParams.set('redirect_uri', `${appUrl}/api/auth/shopify/callback`);
  url.searchParams.set('state', state);
  return url.toString();
}

export async function exchangeCodeForToken(shop: string, code: string): Promise<string> {
  if (!SHOP_DOMAIN_PATTERN.test(shop)) {
    throw new Error(`Invalid Shopify shop domain: ${shop}`);
  }
  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.SHOPIFY_API_KEY,
      client_secret: process.env.SHOPIFY_API_SECRET,
      code,
    }),
  });
  if (!response.ok) {
    throw new Error(`Shopify token exchange failed: ${response.status}`);
  }
  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- oauth`
Expected: 2 tests pass.

- [ ] **Step 5: Add the connect route**

```ts
// src/app/api/auth/shopify/connect/route.ts
import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { buildShopifyAuthUrl } from '@/lib/shopify/oauth';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const shop = searchParams.get('shop');
  if (!shop) {
    return NextResponse.json({ error: 'Missing shop parameter' }, { status: 400 });
  }
  const state = randomBytes(16).toString('hex');
  const authUrl = buildShopifyAuthUrl(shop, state);
  const response = NextResponse.redirect(authUrl);
  response.cookies.set('shopify_oauth_state', state, { httpOnly: true, maxAge: 600, path: '/' });
  return response;
}
```

- [ ] **Step 6: Add the callback route**

```ts
// src/app/api/auth/shopify/callback/route.ts
import { NextResponse } from 'next/server';
import { exchangeCodeForToken } from '@/lib/shopify/oauth';
import { encryptToken } from '@/lib/crypto';
import { db } from '@/db/client';
import { stores } from '@/db/schema';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const shop = searchParams.get('shop');
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const cookieState = request.headers
    .get('cookie')
    ?.split('; ')
    .find((c) => c.startsWith('shopify_oauth_state='))
    ?.split('=')[1];

  if (!shop || !code || !state || state !== cookieState) {
    return NextResponse.redirect(
      new URL('/settings/store?error=oauth_state_mismatch', request.url)
    );
  }

  try {
    const accessToken = await exchangeCodeForToken(shop, code);
    const values = {
      name: shop,
      platform: 'shopify',
      shopDomain: shop,
      accessToken: encryptToken(accessToken),
      status: 'connected' as const,
      lastError: null,
    };
    await db
      .insert(stores)
      .values(values)
      .onConflictDoUpdate({ target: stores.shopDomain, set: values });
    return NextResponse.redirect(new URL('/settings/store?connected=1', request.url));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.redirect(
      new URL(`/settings/store?error=${encodeURIComponent(message)}`, request.url)
    );
  }
}
```

- [ ] **Step 7: Add Shopify app env vars to .env.example**

```
SHOPIFY_API_KEY=your-shopify-app-client-id
SHOPIFY_API_SECRET=your-shopify-app-client-secret
SHOPIFY_APP_URL=https://your-deployed-domain.example.com
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add Shopify OAuth connect and callback routes"
```

---

## Task 7: Shopify API Client + Order Merge Logic

**Files:**
- Create: `src/lib/shopify/client.ts`
- Create: `src/lib/shopify/merge.ts`
- Test: `src/lib/shopify/merge.test.ts`

**Interfaces:**
- Produces: `ShopifyOrder` type and `fetchShopifyOrders(shopDomain: string, accessToken: string, updatedAtMin?: string): Promise<ShopifyOrder[]>` from `client.ts`; `mergeOrderUpdate(existing: ExistingOrder | null, shopifyOrder: ShopifyOrder, storeId: string): NewOrderRow` from `merge.ts`. Both consumed by Task 8's `syncShopifyOrders`.

- [ ] **Step 1: Define the Shopify order type and API client**

```ts
// src/lib/shopify/client.ts
export interface ShopifyOrder {
  id: number;
  order_number: number;
  cancelled_at: string | null;
  fulfillment_status: string | null;
  created_at: string;
  updated_at: string;
  note: string | null;
  total_shipping_price_set?: { shop_money?: { amount: string } };
  payment_gateway_names?: string[];
  customer?: { first_name?: string; last_name?: string; phone?: string };
  shipping_address?: {
    address1?: string;
    city?: string;
    province?: string;
    zip?: string;
    country?: string;
    phone?: string;
  };
  line_items: Array<{ sku: string | null; title: string; quantity: number }>;
  fulfillments?: Array<{ tracking_number?: string; tracking_company?: string }>;
}

export async function fetchShopifyOrders(
  shopDomain: string,
  accessToken: string,
  updatedAtMin?: string
): Promise<ShopifyOrder[]> {
  const url = new URL(`https://${shopDomain}/admin/api/2024-10/orders.json`);
  url.searchParams.set('status', 'any');
  url.searchParams.set('limit', '250');
  if (updatedAtMin) {
    url.searchParams.set('updated_at_min', updatedAtMin);
  }
  const maxRetries = 3;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const response = await fetch(url, {
      headers: { 'X-Shopify-Access-Token': accessToken },
    });
    if (response.status === 429 && attempt < maxRetries) {
      const retryAfterSeconds = Number(response.headers.get('retry-after')) || 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, retryAfterSeconds * 1000));
      continue;
    }
    if (!response.ok) {
      throw new Error(`Shopify orders fetch failed: ${response.status}`);
    }
    const data = (await response.json()) as { orders: ShopifyOrder[] };
    return data.orders;
  }
  throw new Error('Shopify orders fetch failed: exhausted retries after repeated 429 responses');
}
```

- [ ] **Step 2: Write the failing test for mergeOrderUpdate**

```ts
// src/lib/shopify/merge.test.ts
import { describe, it, expect } from 'vitest';
import { mergeOrderUpdate } from './merge';
import type { ShopifyOrder } from './client';

function baseShopifyOrder(overrides: Partial<ShopifyOrder> = {}): ShopifyOrder {
  return {
    id: 1001,
    order_number: 1,
    cancelled_at: null,
    fulfillment_status: null,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    note: null,
    customer: { first_name: 'Ana', last_name: 'Cruz', phone: '0917' },
    shipping_address: { address1: '123 Rd', city: 'Manila', province: 'NCR', zip: '1000', country: 'PH' },
    line_items: [{ sku: 'SKU1', title: 'Shirt', quantity: 2 }],
    fulfillments: [],
    ...overrides,
  };
}

describe('mergeOrderUpdate', () => {
  it('maps a new unfulfilled order to ready_to_ship', () => {
    const result = mergeOrderUpdate(null, baseShopifyOrder(), 'store-1');
    expect(result.status).toBe('ready_to_ship');
    expect(result.customerName).toBe('Ana Cruz');
    expect(result.storeId).toBe('store-1');
  });

  it('maps a cancelled order to cancelled regardless of prior local status', () => {
    const shopifyOrder = baseShopifyOrder({ cancelled_at: '2026-08-02T00:00:00Z' });
    const result = mergeOrderUpdate({ status: 'printed' }, shopifyOrder, 'store-1');
    expect(result.status).toBe('cancelled');
  });

  it('maps a fulfilled order to shipped regardless of prior local status', () => {
    const shopifyOrder = baseShopifyOrder({ fulfillment_status: 'fulfilled' });
    const result = mergeOrderUpdate({ status: 'printed' }, shopifyOrder, 'store-1');
    expect(result.status).toBe('shipped');
  });

  it('preserves a locally-advanced status (printed) when Shopify still reports unfulfilled', () => {
    const result = mergeOrderUpdate({ status: 'printed' }, baseShopifyOrder(), 'store-1');
    expect(result.status).toBe('printed');
  });

  it('preserves a locally-advanced status (packed) when Shopify still reports unfulfilled', () => {
    const result = mergeOrderUpdate({ status: 'packed' }, baseShopifyOrder(), 'store-1');
    expect(result.status).toBe('packed');
  });

  it('does not preserve a non-advanced local status (pending) and takes the derived value', () => {
    const result = mergeOrderUpdate({ status: 'pending' }, baseShopifyOrder(), 'store-1');
    expect(result.status).toBe('ready_to_ship');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- merge`
Expected: FAIL — `Cannot find module './merge'`.

- [ ] **Step 4: Implement merge.ts**

```ts
// src/lib/shopify/merge.ts
import type { ShopifyOrder } from './client';

export type OrderStatus = 'pending' | 'ready_to_ship' | 'printed' | 'packed' | 'shipped' | 'cancelled';

const LOCAL_ADVANCED_STATUSES: OrderStatus[] = ['printed', 'packed'];

export interface ExistingOrder {
  // Plain string, not OrderStatus: this comes straight off the `orders.status`
  // Drizzle column, which is declared as `text()` (no pg enum) in the schema.
  status: string;
}

export interface NewOrderRow {
  storeId: string;
  platformOrderId: string;
  orderNumber: string;
  customerName: string;
  phone: string | null;
  address: Record<string, unknown>;
  items: Array<{ sku: string | null; title: string; quantity: number }>;
  courier: string | null;
  trackingNumber: string | null;
  shippingFee: string | null;
  paymentMethod: string | null;
  status: OrderStatus;
  notes: string | null;
  rawPayload: ShopifyOrder;
}

function mapShopifyStatus(shopifyOrder: ShopifyOrder): OrderStatus {
  if (shopifyOrder.cancelled_at) return 'cancelled';
  if (shopifyOrder.fulfillment_status === 'fulfilled') return 'shipped';
  return 'ready_to_ship';
}

export function mergeOrderUpdate(
  existing: ExistingOrder | null,
  shopifyOrder: ShopifyOrder,
  storeId: string
): NewOrderRow {
  const derivedStatus = mapShopifyStatus(shopifyOrder);
  const derivedIsTerminal = derivedStatus === 'cancelled' || derivedStatus === 'shipped';
  // existing.status is plain `string` (see ExistingOrder above); cast to OrderStatus
  // here since LOCAL_ADVANCED_STATUSES.includes() and the NewOrderRow.status field
  // both require the narrower union type. No runtime change — tsc/next build reject
  // the uncast version even though vitest's esbuild transform doesn't catch it.
  const status: OrderStatus =
    existing && LOCAL_ADVANCED_STATUSES.includes(existing.status as OrderStatus) && !derivedIsTerminal
      ? (existing.status as OrderStatus)
      : derivedStatus;

  const fulfillment = shopifyOrder.fulfillments?.[0];
  const customerName = [shopifyOrder.customer?.first_name, shopifyOrder.customer?.last_name]
    .filter(Boolean)
    .join(' ') || 'Unknown customer';

  return {
    storeId,
    platformOrderId: String(shopifyOrder.id),
    orderNumber: String(shopifyOrder.order_number),
    customerName,
    phone: shopifyOrder.shipping_address?.phone ?? shopifyOrder.customer?.phone ?? null,
    address: shopifyOrder.shipping_address ?? {},
    items: shopifyOrder.line_items.map((item) => ({
      sku: item.sku,
      title: item.title,
      quantity: item.quantity,
    })),
    courier: fulfillment?.tracking_company ?? null,
    trackingNumber: fulfillment?.tracking_number ?? null,
    shippingFee: shopifyOrder.total_shipping_price_set?.shop_money?.amount ?? null,
    paymentMethod: shopifyOrder.payment_gateway_names?.[0] ?? null,
    status,
    notes: shopifyOrder.note,
    rawPayload: shopifyOrder,
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- merge`
Expected: 6 tests pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add Shopify API client and order merge logic"
```

---

## Task 8: Sync Function (DB Integration) + Manual Sync Route

**Files:**
- Create: `src/lib/shopify/sync.ts`
- Create: `src/app/api/sync/shopify/route.ts`
- Test: `src/lib/shopify/sync.integration.test.ts`

**Interfaces:**
- Consumes: `fetchShopifyOrders` (Task 7 `client.ts`), `mergeOrderUpdate` (Task 7 `merge.ts`), `decryptToken` (Task 4), `db`/`stores`/`orders` (Task 3).
- Produces: `syncShopifyOrders(storeId: string, deps?: Partial<SyncDeps>): Promise<SyncResult>` where `SyncResult = { synced: number; failed: boolean; error?: string }` — used by Task 9 (cron) and this task's manual route. Also produces `upsertOrderFromShopify(db: SyncDeps['db'], storeId: string, shopifyOrder: ShopifyOrder): Promise<void>` — the single shared "look up existing order, merge, upsert" routine, used by `syncShopifyOrders` itself and by Task 10's webhook route (so that logic exists in exactly one place).

- [ ] **Step 1: Start the test database**

```bash
docker run --rm -d --name omniship-test-db -e POSTGRES_PASSWORD=test -e POSTGRES_DB=omniship_test -p 5433:5432 postgres:16
DATABASE_URL=postgres://postgres:test@localhost:5433/omniship_test npm run db:migrate
```

- [ ] **Step 2: Write the failing integration test**

```ts
// src/lib/shopify/sync.integration.test.ts
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@/db/schema';
import { syncShopifyOrders } from './sync';
import type { ShopifyOrder } from './client';

const TEST_DB_URL = process.env.DATABASE_URL_TEST ?? 'postgres://postgres:test@localhost:5433/omniship_test';
const queryClient = postgres(TEST_DB_URL);
const testDb = drizzle(queryClient, { schema });

function fakeShopifyOrder(id: number, overrides: Partial<ShopifyOrder> = {}): ShopifyOrder {
  return {
    id,
    order_number: id,
    cancelled_at: null,
    fulfillment_status: null,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    note: null,
    customer: { first_name: 'Ana', last_name: 'Cruz', phone: '0917' },
    shipping_address: { address1: '123 Rd', city: 'Manila', province: 'NCR', zip: '1000', country: 'PH' },
    line_items: [{ sku: 'SKU1', title: 'Shirt', quantity: 1 }],
    fulfillments: [],
    ...overrides,
  };
}

beforeAll(async () => {
  process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
});

beforeEach(async () => {
  await testDb.delete(schema.orders);
  await testDb.delete(schema.stores);
});

describe('syncShopifyOrders', () => {
  it('inserts new orders and updates store.lastSyncedAt', async () => {
    const [store] = await testDb
      .insert(schema.stores)
      .values({
        name: 'test-shop',
        shopDomain: 'test-shop.myshopify.com',
        accessToken: 'encrypted-token-placeholder',
        status: 'connected',
      })
      .returning();

    const result = await syncShopifyOrders(store.id, {
      db: testDb,
      fetchOrders: async () => [fakeShopifyOrder(1), fakeShopifyOrder(2)],
      decrypt: () => 'plaintext-token',
    });

    expect(result).toEqual({ synced: 2, failed: false });

    const rows = await testDb.select().from(schema.orders);
    expect(rows).toHaveLength(2);

    const [updatedStore] = await testDb
      .select()
      .from(schema.stores)
      .where(eq(schema.stores.id, store.id));
    expect(updatedStore.lastSyncedAt).not.toBeNull();
  });

  it('records a failure on the store when the Shopify fetch throws', async () => {
    const [store] = await testDb
      .insert(schema.stores)
      .values({
        name: 'test-shop',
        shopDomain: 'test-shop.myshopify.com',
        accessToken: 'encrypted-token-placeholder',
        status: 'connected',
      })
      .returning();

    const result = await syncShopifyOrders(store.id, {
      db: testDb,
      fetchOrders: async () => {
        throw new Error('rate limited');
      },
      decrypt: () => 'plaintext-token',
    });

    expect(result.failed).toBe(true);
    expect(result.error).toContain('rate limited');

    const [updatedStore] = await testDb
      .select()
      .from(schema.stores)
      .where(eq(schema.stores.id, store.id));
    expect(updatedStore.status).toBe('error');
    expect(updatedStore.lastError).toContain('rate limited');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `DATABASE_URL_TEST=postgres://postgres:test@localhost:5433/omniship_test npm test -- sync.integration`
Expected: FAIL — `Cannot find module './sync'`.

- [ ] **Step 4: Implement sync.ts**

```ts
// src/lib/shopify/sync.ts
import { and, eq } from 'drizzle-orm';
import { db as defaultDb } from '@/db/client';
import { stores, orders } from '@/db/schema';
import { fetchShopifyOrders as defaultFetchOrders, type ShopifyOrder } from './client';
import { mergeOrderUpdate } from './merge';
import { decryptToken as defaultDecrypt } from '@/lib/crypto';

export interface SyncResult {
  synced: number;
  failed: boolean;
  error?: string;
}

export interface SyncDeps {
  db: typeof defaultDb;
  fetchOrders: typeof defaultFetchOrders;
  decrypt: typeof defaultDecrypt;
}

/**
 * Looks up the existing order by (storeId, platformOrderId), merges it with
 * the incoming Shopify payload via mergeOrderUpdate, and upserts the result.
 * Shared by syncShopifyOrders (below) and the webhook route (Task 10) so the
 * upsert logic exists in exactly one place.
 */
export async function upsertOrderFromShopify(
  db: SyncDeps['db'],
  storeId: string,
  shopifyOrder: ShopifyOrder
): Promise<void> {
  const platformOrderId = String(shopifyOrder.id);
  const [existing] = await db
    .select({ status: orders.status })
    .from(orders)
    .where(and(eq(orders.storeId, storeId), eq(orders.platformOrderId, platformOrderId)));

  const merged = mergeOrderUpdate(existing ?? null, shopifyOrder, storeId);

  await db
    .insert(orders)
    .values(merged)
    .onConflictDoUpdate({
      target: [orders.storeId, orders.platformOrderId],
      set: { ...merged, syncedAt: new Date() },
    });
}

export async function syncShopifyOrders(storeId: string, overrides: Partial<SyncDeps> = {}): Promise<SyncResult> {
  const deps: SyncDeps = {
    db: overrides.db ?? defaultDb,
    fetchOrders: overrides.fetchOrders ?? defaultFetchOrders,
    decrypt: overrides.decrypt ?? defaultDecrypt,
  };
  const { db, fetchOrders, decrypt } = deps;

  const [store] = await db.select().from(stores).where(eq(stores.id, storeId));
  if (!store) {
    return { synced: 0, failed: true, error: 'Store not found' };
  }

  try {
    const accessToken = decrypt(store.accessToken);
    const updatedAtMin = store.lastSyncedAt ? store.lastSyncedAt.toISOString() : undefined;
    const shopifyOrders = await fetchOrders(store.shopDomain, accessToken, updatedAtMin);

    for (const shopifyOrder of shopifyOrders) {
      await upsertOrderFromShopify(db, storeId, shopifyOrder);
    }

    await db
      .update(stores)
      .set({ lastSyncedAt: new Date(), status: 'connected', lastError: null })
      .where(eq(stores.id, storeId));

    return { synced: shopifyOrders.length, failed: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown sync error';
    await db.update(stores).set({ status: 'error', lastError: message }).where(eq(stores.id, storeId));
    return { synced: 0, failed: true, error: message };
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `DATABASE_URL_TEST=postgres://postgres:test@localhost:5433/omniship_test npm test -- sync.integration`
Expected: 2 tests pass.

- [ ] **Step 6: Add the manual sync route**

```ts
// src/app/api/sync/shopify/route.ts
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
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add Shopify sync function and manual sync route"
```

---

## Task 9: Vercel Cron Sync Route

**Files:**
- Create: `src/lib/cron/auth.ts`
- Create: `src/app/api/cron/sync-shopify/route.ts`
- Create: `vercel.json`
- Test: `src/lib/cron/auth.test.ts`

**Interfaces:**
- Consumes: `syncShopifyOrders` (Task 8), `db`/`stores` (Task 3).
- Produces: `isAuthorizedCronRequest(authHeader: string | null, secret: string): boolean`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/cron/auth.test.ts
import { describe, it, expect } from 'vitest';
import { isAuthorizedCronRequest } from './auth';

describe('isAuthorizedCronRequest', () => {
  it('accepts a matching bearer token', () => {
    expect(isAuthorizedCronRequest('Bearer abc123', 'abc123')).toBe(true);
  });

  it('rejects a missing header', () => {
    expect(isAuthorizedCronRequest(null, 'abc123')).toBe(false);
  });

  it('rejects a mismatched token', () => {
    expect(isAuthorizedCronRequest('Bearer wrong', 'abc123')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- cron/auth`
Expected: FAIL — `Cannot find module './auth'`.

- [ ] **Step 3: Implement auth.ts**

```ts
// src/lib/cron/auth.ts
export function isAuthorizedCronRequest(authHeader: string | null, secret: string): boolean {
  return authHeader === `Bearer ${secret}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- cron/auth`
Expected: 3 tests pass.

- [ ] **Step 5: Implement the cron route**

```ts
// src/app/api/cron/sync-shopify/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { stores } from '@/db/schema';
import { syncShopifyOrders } from '@/lib/shopify/sync';
import { isAuthorizedCronRequest } from '@/lib/cron/auth';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!isAuthorizedCronRequest(authHeader, process.env.CRON_SECRET ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const allStores = await db.select().from(stores);
  const results = await Promise.all(allStores.map((store) => syncShopifyOrders(store.id)));
  return NextResponse.json({ results });
}
```

- [ ] **Step 6: Configure Vercel Cron**

```json
// vercel.json
{
  "crons": [{ "path": "/api/cron/sync-shopify", "schedule": "*/5 * * * *" }]
}
```

Add to `.env.example`:

```
CRON_SECRET=replace-with-a-long-random-string
```

Vercel automatically sends `Authorization: Bearer $CRON_SECRET` to cron-triggered requests when `CRON_SECRET` is set as an env var on the project — no extra config needed beyond that.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add Vercel Cron sync route with secret auth"
```

---

## Task 10: Shopify Webhook Receiver

**Files:**
- Create: `src/lib/shopify/webhook-verify.ts`
- Create: `src/app/api/webhooks/shopify/orders/route.ts`
- Test: `src/lib/shopify/webhook-verify.test.ts`
- Test: `src/app/api/webhooks/shopify/orders/route.integration.test.ts`

**Interfaces:**
- Consumes: `upsertOrderFromShopify` (Task 8 `sync.ts`), `db`/`stores` (Task 3).
- Produces: `verifyShopifyWebhook(rawBody: string, hmacHeader: string | null, secret: string): boolean`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/shopify/webhook-verify.test.ts
import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { verifyShopifyWebhook } from './webhook-verify';

describe('verifyShopifyWebhook', () => {
  const secret = 'test-webhook-secret';
  const body = JSON.stringify({ id: 123, order_number: 1 });

  it('accepts a correctly signed payload', () => {
    const hmac = createHmac('sha256', secret).update(body, 'utf8').digest('base64');
    expect(verifyShopifyWebhook(body, hmac, secret)).toBe(true);
  });

  it('rejects a payload with the wrong signature', () => {
    expect(verifyShopifyWebhook(body, 'bogus-signature==', secret)).toBe(false);
  });

  it('rejects a missing signature header', () => {
    expect(verifyShopifyWebhook(body, null, secret)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- webhook-verify`
Expected: FAIL — `Cannot find module './webhook-verify'`.

- [ ] **Step 3: Implement webhook-verify.ts**

```ts
// src/lib/shopify/webhook-verify.ts
import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifyShopifyWebhook(rawBody: string, hmacHeader: string | null, secret: string): boolean {
  if (!hmacHeader) return false;
  const digest = createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
  const digestBuffer = Buffer.from(digest);
  const headerBuffer = Buffer.from(hmacHeader);
  if (digestBuffer.length !== headerBuffer.length) return false;
  return timingSafeEqual(digestBuffer, headerBuffer);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- webhook-verify`
Expected: 3 tests pass.

- [ ] **Step 5: Implement the webhook route**

```ts
// src/app/api/webhooks/shopify/orders/route.ts
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { verifyShopifyWebhook } from '@/lib/shopify/webhook-verify';
import { upsertOrderFromShopify } from '@/lib/shopify/sync';
import { db } from '@/db/client';
import { stores } from '@/db/schema';
import type { ShopifyOrder } from '@/lib/shopify/client';

export async function POST(request: Request) {
  const rawBody = await request.text();
  const hmacHeader = request.headers.get('x-shopify-hmac-sha256');
  const shopDomain = request.headers.get('x-shopify-shop-domain');

  if (!verifyShopifyWebhook(rawBody, hmacHeader, process.env.SHOPIFY_API_SECRET ?? '')) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }
  if (!shopDomain) {
    return NextResponse.json({ error: 'Missing shop domain' }, { status: 400 });
  }

  const [store] = await db.select().from(stores).where(eq(stores.shopDomain, shopDomain));
  if (!store) {
    return NextResponse.json({ error: 'Unknown store' }, { status: 404 });
  }

  const shopifyOrder = JSON.parse(rawBody) as ShopifyOrder;
  await upsertOrderFromShopify(db, store.id, shopifyOrder);

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 6: Write the failing integration test for the webhook route**

```ts
// src/app/api/webhooks/shopify/orders/route.integration.test.ts
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createHmac } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@/db/schema';
import { POST } from './route';

const TEST_DB_URL = process.env.DATABASE_URL_TEST ?? 'postgres://postgres:test@localhost:5433/omniship_test';
const queryClient = postgres(TEST_DB_URL);
const testDb = drizzle(queryClient, { schema });
const WEBHOOK_SECRET = 'test-webhook-secret';

beforeAll(() => {
  process.env.DATABASE_URL = TEST_DB_URL;
  process.env.SHOPIFY_API_SECRET = WEBHOOK_SECRET;
});

beforeEach(async () => {
  await testDb.delete(schema.orders);
  await testDb.delete(schema.stores);
});

function signedRequest(shopDomain: string, payload: object) {
  const rawBody = JSON.stringify(payload);
  const hmac = createHmac('sha256', WEBHOOK_SECRET).update(rawBody, 'utf8').digest('base64');
  return new Request('http://localhost/api/webhooks/shopify/orders', {
    method: 'POST',
    headers: { 'x-shopify-hmac-sha256': hmac, 'x-shopify-shop-domain': shopDomain },
    body: rawBody,
  });
}

describe('POST /api/webhooks/shopify/orders', () => {
  it('rejects a payload with an invalid signature', async () => {
    const request = new Request('http://localhost/api/webhooks/shopify/orders', {
      method: 'POST',
      headers: { 'x-shopify-hmac-sha256': 'bogus==', 'x-shopify-shop-domain': 'shop.myshopify.com' },
      body: JSON.stringify({ id: 1 }),
    });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('upserts an order from a validly signed webhook', async () => {
    const [store] = await testDb
      .insert(schema.stores)
      .values({ name: 's', shopDomain: 's.myshopify.com', accessToken: 'x', status: 'connected' })
      .returning();

    const request = signedRequest('s.myshopify.com', {
      id: 555,
      order_number: 555,
      cancelled_at: null,
      fulfillment_status: null,
      created_at: '2026-08-01T00:00:00Z',
      updated_at: '2026-08-01T00:00:00Z',
      note: null,
      customer: { first_name: 'Cy', last_name: 'Santos' },
      shipping_address: {},
      line_items: [],
      fulfillments: [],
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const rows = await testDb.select().from(schema.orders).where(eq(schema.orders.storeId, store.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].customerName).toBe('Cy Santos');
  });
});
```

- [ ] **Step 7: Run test to verify it fails, then passes**

Run: `npm run test:integration`
Expected: first run FAILS (module/behavior not yet wired up if written before Step 5's route code); after Step 5's route implementation is in place, re-run and expect both tests to PASS.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add HMAC-verified Shopify webhook receiver"
```

---

## Task 11: Order Filters Parsing

**Files:**
- Create: `src/lib/orders/filters.ts`
- Test: `src/lib/orders/filters.test.ts`

**Interfaces:**
- Produces: `OrderFilters` type and `parseOrderFilters(searchParams: URLSearchParams): OrderFilters` — consumed by Task 12's API route and Task 14's orders page.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/orders/filters.test.ts
import { describe, it, expect } from 'vitest';
import { parseOrderFilters } from './filters';

describe('parseOrderFilters', () => {
  it('defaults sort to newest when absent or invalid', () => {
    expect(parseOrderFilters(new URLSearchParams()).sort).toBe('newest');
    expect(parseOrderFilters(new URLSearchParams('sort=bogus')).sort).toBe('newest');
  });

  it('accepts valid sort values', () => {
    expect(parseOrderFilters(new URLSearchParams('sort=oldest')).sort).toBe('oldest');
    expect(parseOrderFilters(new URLSearchParams('sort=courier')).sort).toBe('courier');
  });

  it('parses status, courier, and paymentMethod filters', () => {
    const filters = parseOrderFilters(new URLSearchParams('status=printed&courier=LBC&paymentMethod=COD'));
    expect(filters.status).toBe('printed');
    expect(filters.courier).toBe('LBC');
    expect(filters.paymentMethod).toBe('COD');
  });

  it('trims keyword and treats blank keyword as undefined', () => {
    expect(parseOrderFilters(new URLSearchParams('keyword=  hello  ')).keyword).toBe('hello');
    expect(parseOrderFilters(new URLSearchParams('keyword=   ')).keyword).toBeUndefined();
  });

  it('parses dateFrom and dateTo', () => {
    const filters = parseOrderFilters(new URLSearchParams('dateFrom=2026-08-01&dateTo=2026-08-06'));
    expect(filters.dateFrom).toBe('2026-08-01');
    expect(filters.dateTo).toBe('2026-08-06');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- orders/filters`
Expected: FAIL — `Cannot find module './filters'`.

- [ ] **Step 3: Implement filters.ts**

```ts
// src/lib/orders/filters.ts
import type { OrderStatus } from '@/lib/shopify/merge';

export interface OrderFilters {
  platform?: string;
  courier?: string;
  status?: OrderStatus;
  paymentMethod?: string;
  dateFrom?: string;
  dateTo?: string;
  keyword?: string;
  sort: 'newest' | 'oldest' | 'courier';
}

const VALID_SORTS = ['newest', 'oldest', 'courier'] as const;

export function parseOrderFilters(searchParams: URLSearchParams): OrderFilters {
  const sortParam = searchParams.get('sort');
  const sort = (VALID_SORTS as readonly string[]).includes(sortParam ?? '')
    ? (sortParam as OrderFilters['sort'])
    : 'newest';

  return {
    platform: searchParams.get('platform') ?? undefined,
    courier: searchParams.get('courier') ?? undefined,
    status: (searchParams.get('status') as OrderStatus | null) ?? undefined,
    paymentMethod: searchParams.get('paymentMethod') ?? undefined,
    dateFrom: searchParams.get('dateFrom') ?? undefined,
    dateTo: searchParams.get('dateTo') ?? undefined,
    keyword: searchParams.get('keyword')?.trim() || undefined,
    sort,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- orders/filters`
Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add order filter query parsing"
```

---

## Task 12: Orders API Route

**Files:**
- Create: `src/app/api/orders/route.ts`
- Test: `src/app/api/orders/route.integration.test.ts`

**Interfaces:**
- Consumes: `parseOrderFilters` (Task 11), `db`/`orders` (Task 3), `createSupabaseServerClient` (Task 5).
- Produces: `GET /api/orders` returning `{ orders: OrderRow[] }`, consumed by Task 14's orders page.

- [ ] **Step 1: Write the failing integration test**

```ts
// src/app/api/orders/route.integration.test.ts
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@/db/schema';

const TEST_DB_URL = process.env.DATABASE_URL_TEST ?? 'postgres://postgres:test@localhost:5433/omniship_test';
const queryClient = postgres(TEST_DB_URL);
const testDb = drizzle(queryClient, { schema });

// The route module reads `db` from '@/db/client' directly, so this test
// seeds the same physical test database (DATABASE_URL points at it via
// the test env, see package.json "test:integration" script) and calls
// the exported GET handler in-process.
import { GET } from './route';

beforeAll(() => {
  process.env.DATABASE_URL = TEST_DB_URL;
});

beforeEach(async () => {
  await testDb.delete(schema.orders);
  await testDb.delete(schema.stores);
});

describe('GET /api/orders', () => {
  it('filters by status and returns matching orders', async () => {
    const [store] = await testDb
      .insert(schema.stores)
      .values({ name: 's', shopDomain: 's.myshopify.com', accessToken: 'x', status: 'connected' })
      .returning();

    await testDb.insert(schema.orders).values([
      {
        storeId: store.id,
        platformOrderId: '1',
        orderNumber: '1001',
        customerName: 'Ana Cruz',
        address: {},
        items: [],
        status: 'ready_to_ship',
      },
      {
        storeId: store.id,
        platformOrderId: '2',
        orderNumber: '1002',
        customerName: 'Bea Reyes',
        address: {},
        items: [],
        status: 'printed',
      },
    ]);

    const request = new Request('http://localhost/api/orders?status=printed');
    const response = await GET(request);
    const body = await response.json();

    expect(body.orders).toHaveLength(1);
    expect(body.orders[0].customerName).toBe('Bea Reyes');
  });
});
```

Add to `package.json` scripts: `"test:integration": "DATABASE_URL_TEST=postgres://postgres:test@localhost:5433/omniship_test vitest run --config vitest.integration.config.ts"`.

Create `vitest.integration.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.integration.test.ts'],
    // Integration test files share one Postgres DB and truncate the same
    // tables in beforeEach — running files in parallel races them against
    // each other. Force serial execution across files.
    fileParallelism: false,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:integration`
Expected: FAIL — `Cannot find module './route'`.

- [ ] **Step 3: Implement the orders route**

```ts
// src/app/api/orders/route.ts
import { NextResponse } from 'next/server';
import { and, eq, ilike, or, desc, asc } from 'drizzle-orm';
import { db } from '@/db/client';
import { orders } from '@/db/schema';
import { parseOrderFilters } from '@/lib/orders/filters';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filters = parseOrderFilters(searchParams);

  const conditions = [];
  if (filters.status) conditions.push(eq(orders.status, filters.status));
  if (filters.courier) conditions.push(eq(orders.courier, filters.courier));
  if (filters.paymentMethod) conditions.push(eq(orders.paymentMethod, filters.paymentMethod));
  if (filters.keyword) {
    conditions.push(
      or(ilike(orders.customerName, `%${filters.keyword}%`), ilike(orders.orderNumber, `%${filters.keyword}%`))
    );
  }

  const orderBy =
    filters.sort === 'oldest'
      ? asc(orders.createdAt)
      : filters.sort === 'courier'
        ? asc(orders.courier)
        : desc(orders.createdAt);

  const rows = await db
    .select()
    .from(orders)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(orderBy);

  return NextResponse.json({ orders: rows });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:integration`
Expected: 1 test passes.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add filtered/sorted orders API route"
```

---

## Task 13: Dashboard Page

**Files:**
- Create: `src/app/page.tsx`
- Create: `src/components/sync-status-indicator.tsx`
- Create: `src/components/dashboard-sync-controls.tsx`
- Test: `src/components/sync-status-indicator.test.tsx`

**Interfaces:**
- Consumes: `AppShell` (Task 2), `db`/`orders`/`stores` (Task 3), `POST /api/sync/shopify` (Task 8).
- Produces: `SyncStatusIndicator` component — `<SyncStatusIndicator lastSyncedAt={Date | null} status={'connected'|'error'|'disconnected'} onSync={() => void} syncing={boolean} />`; `DashboardSyncControls` — `<DashboardSyncControls lastSyncedAt={string | null} status={'connected'|'error'|'disconnected'} />` (client wrapper that calls the sync API and wires up `SyncStatusIndicator`).

- [ ] **Step 1: Write the failing test for SyncStatusIndicator**

```tsx
// src/components/sync-status-indicator.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SyncStatusIndicator } from './sync-status-indicator';

describe('SyncStatusIndicator', () => {
  it('shows the error state and calls onSync when clicked', () => {
    const onSync = vi.fn();
    render(<SyncStatusIndicator lastSyncedAt={null} status="error" syncing={false} onSync={onSync} />);
    expect(screen.getByText(/sync failed/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /sync now/i }));
    expect(onSync).toHaveBeenCalledOnce();
  });

  it('disables the button while syncing', () => {
    render(<SyncStatusIndicator lastSyncedAt={new Date()} status="connected" syncing onSync={() => {}} />);
    expect(screen.getByRole('button', { name: /syncing/i })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- sync-status-indicator`
Expected: FAIL — `Cannot find module './sync-status-indicator'`.

- [ ] **Step 3: Implement SyncStatusIndicator**

```tsx
// src/components/sync-status-indicator.tsx
import { Button } from '@/components/ui/button';

interface SyncStatusIndicatorProps {
  lastSyncedAt: Date | null;
  status: 'connected' | 'error' | 'disconnected';
  syncing: boolean;
  onSync: () => void;
}

export function SyncStatusIndicator({ lastSyncedAt, status, syncing, onSync }: SyncStatusIndicatorProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground">
        {status === 'error'
          ? 'Sync failed'
          : lastSyncedAt
            ? `Last synced ${lastSyncedAt.toLocaleTimeString()}`
            : 'Never synced'}
      </span>
      <Button size="sm" onClick={onSync} disabled={syncing}>
        {syncing ? 'Syncing…' : 'Sync now'}
      </Button>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- sync-status-indicator`
Expected: 2 tests pass.

- [ ] **Step 5: Implement the client-side sync controls**

The dashboard's stats are server-rendered, but "Sync now" needs client interactivity (loading state, calling the API, refreshing). This wraps `SyncStatusIndicator` with that behavior.

```tsx
// src/components/dashboard-sync-controls.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { SyncStatusIndicator } from './sync-status-indicator';

interface DashboardSyncControlsProps {
  lastSyncedAt: string | null;
  status: 'connected' | 'error' | 'disconnected';
}

export function DashboardSyncControls({ lastSyncedAt, status }: DashboardSyncControlsProps) {
  const [syncing, setSyncing] = useState(false);
  const router = useRouter();

  async function handleSync() {
    setSyncing(true);
    try {
      const response = await fetch('/api/sync/shopify', { method: 'POST' });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error ?? 'Sync failed');
      }
      toast.success('Sync complete');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <SyncStatusIndicator
      lastSyncedAt={lastSyncedAt ? new Date(lastSyncedAt) : null}
      status={status}
      syncing={syncing}
      onSync={handleSync}
    />
  );
}
```

- [ ] **Step 6: Build the dashboard page**

```tsx
// src/app/page.tsx
import { eq, count } from 'drizzle-orm';
import { AppShell } from '@/components/app-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardSyncControls } from '@/components/dashboard-sync-controls';
import { db } from '@/db/client';
import { orders, stores } from '@/db/schema';

const STATUS_TILES = ['pending', 'ready_to_ship', 'printed', 'shipped', 'cancelled'] as const;

export default async function DashboardPage() {
  const [store] = await db.select().from(stores).limit(1);

  const counts = await Promise.all(
    STATUS_TILES.map(async (status) => {
      const [{ value }] = await db
        .select({ value: count() })
        .from(orders)
        .where(eq(orders.status, status));
      return { status, value };
    })
  );

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        {store && (
          <DashboardSyncControls
            lastSyncedAt={store.lastSyncedAt?.toISOString() ?? null}
            status={store.status as 'connected' | 'error' | 'disconnected'}
          />
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {counts.map(({ status, value }) => (
          <Card key={status}>
            <CardHeader>
              <CardTitle className="text-sm font-normal text-muted-foreground capitalize">
                {status.replace('_', ' ')}
              </CardTitle>
            </CardHeader>
            <CardContent className="font-mono text-3xl">{value}</CardContent>
          </Card>
        ))}
      </div>
      {!store && (
        <p className="mt-6 text-sm text-muted-foreground">
          No store connected yet. Go to Settings to connect Shopify.
        </p>
      )}
    </AppShell>
  );
}
```

- [ ] **Step 7: Manual verification**

Run: `npm run dev`, sign in, visit `/`. Expected: five status tiles render with counts (0 if the database is empty); if a store is connected, a "Sync now" control appears, shows "Syncing…" while in flight, and updates "Last synced" after completion; a "connect Shopify" hint appears if no store row exists.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add dashboard page with status tiles"
```

---

## Task 14: Orders List Page

**Files:**
- Create: `src/components/order-table.tsx`
- Create: `src/components/order-filters.tsx`
- Create: `src/app/orders/page.tsx`
- Test: `src/components/order-table.test.tsx`

**Interfaces:**
- Consumes: `AppShell` (Task 2), `GET /api/orders` (Task 12).
- Produces: `OrderTable` — `<OrderTable orders={OrderRow[]} selected={Set<string>} onSelectionChange={(ids: Set<string>) => void} />`; `OrderFilters` — `<OrderFilters initial={OrderFilters} />` (client component that updates the URL query string).

- [ ] **Step 1: Write the failing test for OrderTable selection**

```tsx
// src/components/order-table.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { OrderTable } from './order-table';

const orders = [
  { id: 'o1', orderNumber: '1001', customerName: 'Ana Cruz', courier: 'LBC', status: 'ready_to_ship' },
  { id: 'o2', orderNumber: '1002', customerName: 'Bea Reyes', courier: 'J&T', status: 'printed' },
];

describe('OrderTable', () => {
  it('toggles a row into the selection set on checkbox click', () => {
    const onSelectionChange = vi.fn();
    render(<OrderTable orders={orders} selected={new Set()} onSelectionChange={onSelectionChange} />);
    fireEvent.click(screen.getByLabelText('Select order 1001'));
    expect(onSelectionChange).toHaveBeenCalledWith(new Set(['o1']));
  });

  it('renders customer name and status badge for each row', () => {
    render(<OrderTable orders={orders} selected={new Set()} onSelectionChange={() => {}} />);
    expect(screen.getByText('Ana Cruz')).toBeInTheDocument();
    expect(screen.getByText('Bea Reyes')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- order-table`
Expected: FAIL — `Cannot find module './order-table'`.

- [ ] **Step 3: Implement OrderTable**

```tsx
// src/components/order-table.tsx
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export interface OrderRow {
  id: string;
  orderNumber: string;
  customerName: string;
  courier: string | null;
  status: string;
}

interface OrderTableProps {
  orders: OrderRow[];
  selected: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
}

export function OrderTable({ orders, selected, onSelectionChange }: OrderTableProps) {
  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead />
          <TableHead>Order #</TableHead>
          <TableHead>Customer</TableHead>
          <TableHead>Courier</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => (
          <TableRow key={order.id}>
            <TableCell>
              <input
                type="checkbox"
                aria-label={`Select order ${order.orderNumber}`}
                checked={selected.has(order.id)}
                onChange={() => toggle(order.id)}
              />
            </TableCell>
            <TableCell className="font-mono">
              <Link href={`/orders/${order.id}`}>{order.orderNumber}</Link>
            </TableCell>
            <TableCell>{order.customerName}</TableCell>
            <TableCell>{order.courier ?? '—'}</TableCell>
            <TableCell>
              <Badge variant="secondary" className="capitalize">
                {order.status.replace('_', ' ')}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- order-table`
Expected: 2 tests pass.

- [ ] **Step 5: Implement OrderFilters (client component)**

```tsx
// src/components/order-filters.tsx
'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const STATUS_OPTIONS = ['pending', 'ready_to_ship', 'printed', 'packed', 'shipped', 'cancelled'];
const SORT_OPTIONS = ['newest', 'oldest', 'courier'];

export function OrderFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-3 mb-4">
      <Input
        placeholder="Search order # or customer"
        defaultValue={searchParams.get('keyword') ?? ''}
        onChange={(e) => updateParam('keyword', e.target.value)}
        className="max-w-xs"
      />
      <Select defaultValue={searchParams.get('status') ?? ''} onValueChange={(v) => updateParam('status', v)}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((status) => (
            <SelectItem key={status} value={status}>
              {status.replace('_', ' ')}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select defaultValue={searchParams.get('sort') ?? 'newest'} onValueChange={(v) => updateParam('sort', v)}>
        <SelectTrigger className="w-32">
          <SelectValue placeholder="Sort" />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((sort) => (
            <SelectItem key={sort} value={sort}>
              {sort}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
```

- [ ] **Step 6: Build the orders page**

```tsx
// src/app/orders/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { OrderFilters } from '@/components/order-filters';
import { OrderTable, type OrderRow } from '@/components/order-table';
import { Button } from '@/components/ui/button';

export default function OrdersPage() {
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch(`/api/orders?${searchParams.toString()}`)
      .then((res) => res.json())
      .then((data) => setOrders(data.orders));
  }, [searchParams]);

  function printSelected() {
    const ids = Array.from(selected).join(',');
    window.open(`/print/${ids}?paperSize=4x6&documentType=waybill`, '_blank');
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Orders</h1>
        <Button onClick={printSelected} disabled={selected.size === 0}>
          Print Selected ({selected.size})
        </Button>
      </div>
      <OrderFilters />
      <OrderTable orders={orders} selected={selected} onSelectionChange={setSelected} />
    </AppShell>
  );
}
```

- [ ] **Step 7: Manual verification**

Run: `npm run dev`, visit `/orders`. Expected: filters update the URL and refetch; selecting rows enables "Print Selected".

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add orders list page with filters and bulk selection"
```

---

## Task 15: Order Detail Page

**Files:**
- Create: `src/app/orders/[id]/page.tsx`

**Interfaces:**
- Consumes: `AppShell` (Task 2), `db`/`orders` (Task 3).

- [ ] **Step 1: Build the order detail page**

```tsx
// src/app/orders/[id]/page.tsx
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { db } from '@/db/client';
import { orders } from '@/db/schema';

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { id } = await params;
  const [order] = await db.select().from(orders).where(eq(orders.id, id));
  if (!order) notFound();

  const address = order.address as Record<string, string>;
  const items = order.items as Array<{ sku: string | null; title: string; quantity: number }>;

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold font-mono">Order #{order.orderNumber}</h1>
        <div className="flex gap-2">
          <a href={`/print/${order.id}?paperSize=4x6&documentType=waybill`} target="_blank" rel="noreferrer">
            <Button variant="outline">Print Waybill</Button>
          </a>
          <a href={`/print/${order.id}?paperSize=letter&documentType=packing_slip`} target="_blank" rel="noreferrer">
            <Button variant="outline">Print Packing Slip</Button>
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Customer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>{order.customerName}</p>
            <p>{order.phone}</p>
            <p>
              {address.address1}, {address.city}, {address.province} {address.zip}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Shipping</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>Courier: {order.courier ?? '—'}</p>
            <p className="font-mono">Tracking: {order.trackingNumber ?? '—'}</p>
            <p>Fee: {order.shippingFee ?? '—'}</p>
            <p>Payment: {order.paymentMethod ?? '—'}</p>
          </CardContent>
        </Card>

        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Products</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm space-y-1">
              {items.map((item, i) => (
                <li key={i}>
                  {item.quantity}× {item.title} {item.sku ? `(${item.sku})` : ''}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {order.notes && (
          <Card className="col-span-2">
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">{order.notes}</CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 2: Manual verification**

Run: `npm run dev`, visit `/orders/<an-order-id>`. Expected: customer/shipping/product info renders; both print buttons open `/print/...` in a new tab.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add order detail page"
```

---

## Task 16: Barcode/QR Helpers + Components

**Files:**
- Create: `src/lib/print/codes.ts`
- Create: `src/components/barcode-block.tsx`, `src/components/qr-block.tsx`
- Test: `src/lib/print/codes.test.ts`

**Interfaces:**
- Produces: `getTrackingBarcodeValue(trackingNumber: string): string`, `getOrderQrPayload(order: { id: string; orderNumber: string }): string`; `BarcodeBlock` — `<BarcodeBlock value={string} />`; `QRBlock` — `<QRBlock value={string} />`. Consumed by Task 17's `PrintPreviewDocument`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/print/codes.test.ts
import { describe, it, expect } from 'vitest';
import { getTrackingBarcodeValue, getOrderQrPayload } from './codes';

describe('getTrackingBarcodeValue', () => {
  it('strips whitespace and uppercases', () => {
    expect(getTrackingBarcodeValue(' lbc 123 456 ')).toBe('LBC123456');
  });
});

describe('getOrderQrPayload', () => {
  it('encodes order id and number as JSON', () => {
    const payload = getOrderQrPayload({ id: 'abc-123', orderNumber: '1001' });
    expect(JSON.parse(payload)).toEqual({ orderId: 'abc-123', orderNumber: '1001' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- print/codes`
Expected: FAIL — `Cannot find module './codes'`.

- [ ] **Step 3: Implement codes.ts**

```ts
// src/lib/print/codes.ts
export function getTrackingBarcodeValue(trackingNumber: string): string {
  return trackingNumber.trim().toUpperCase().replace(/\s+/g, '');
}

export function getOrderQrPayload(order: { id: string; orderNumber: string }): string {
  return JSON.stringify({ orderId: order.id, orderNumber: order.orderNumber });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- print/codes`
Expected: 2 tests pass.

- [ ] **Step 5: Implement BarcodeBlock and QRBlock**

```tsx
// src/components/barcode-block.tsx
'use client';

import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

export function BarcodeBlock({ value }: { value: string }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (svgRef.current) {
      JsBarcode(svgRef.current, value, { format: 'CODE128', height: 40, displayValue: true, fontSize: 12 });
    }
  }, [value]);

  return <svg ref={svgRef} />;
}
```

```tsx
// src/components/qr-block.tsx
'use client';

import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

export function QRBlock({ value }: { value: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, value, { width: 96, margin: 0 });
    }
  }, [value]);

  return <canvas ref={canvasRef} />;
}
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add barcode/QR data helpers and rendering components"
```

---

## Task 17: Print Preview Document + Print Route + Print History

**Files:**
- Create: `src/components/print-preview-document.tsx`
- Create: `src/app/print/[batch]/page.tsx`
- Create: `src/app/api/print-history/route.ts`

**Interfaces:**
- Consumes: `BarcodeBlock`/`QRBlock` (Task 16), `getTrackingBarcodeValue`/`getOrderQrPayload` (Task 16), `db`/`orders`/`printHistory` (Task 3), `createSupabaseServerClient` (Task 5).
- Produces: `PrintPreviewDocument` — `<PrintPreviewDocument orders={OrderRow[]} paperSize={PaperSize} documentType={'waybill'|'packing_slip'} />`.

- [ ] **Step 1: Implement PrintPreviewDocument**

```tsx
// src/components/print-preview-document.tsx
import { BarcodeBlock } from './barcode-block';
import { QRBlock } from './qr-block';
import { getTrackingBarcodeValue, getOrderQrPayload } from '@/lib/print/codes';

export type PaperSize = '4x6' | 'a6' | 'a5' | 'letter';

const PAGE_SIZES: Record<PaperSize, string> = {
  '4x6': '4in 6in',
  a6: '105mm 148mm',
  a5: '148mm 210mm',
  letter: '8.5in 11in',
};

interface PrintOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  phone: string | null;
  address: Record<string, string>;
  items: Array<{ sku: string | null; title: string; quantity: number }>;
  courier: string | null;
  trackingNumber: string | null;
}

interface PrintPreviewDocumentProps {
  orders: PrintOrder[];
  paperSize: PaperSize;
  documentType: 'waybill' | 'packing_slip';
}

export function PrintPreviewDocument({ orders, paperSize, documentType }: PrintPreviewDocumentProps) {
  return (
    <div>
      <style>{`@page { size: ${PAGE_SIZES[paperSize]}; margin: 8mm; } .print-section { page-break-after: always; }`}</style>
      {orders.map((order) => (
        <section key={order.id} className="print-section p-2 font-sans text-sm">
          <h2 className="font-mono font-semibold text-base">Order #{order.orderNumber}</h2>
          <p>{order.customerName}</p>
          <p>{order.phone}</p>
          <p>
            {order.address.address1}, {order.address.city}, {order.address.province} {order.address.zip}
          </p>

          {documentType === 'waybill' ? (
            <>
              <p>Courier: {order.courier ?? '—'}</p>
              {order.trackingNumber && <BarcodeBlock value={getTrackingBarcodeValue(order.trackingNumber)} />}
            </>
          ) : (
            <ul>
              {order.items.map((item, i) => (
                <li key={i}>
                  {item.quantity}× {item.title} {item.sku ? `(${item.sku})` : ''}
                </li>
              ))}
            </ul>
          )}

          <QRBlock value={getOrderQrPayload(order)} />
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Implement the print-history API route**

```ts
// src/app/api/print-history/route.ts
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
```

- [ ] **Step 3: Implement the print route/page**

```tsx
// src/app/print/[batch]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { PrintPreviewDocument, type PaperSize } from '@/components/print-preview-document';

export default function PrintBatchPage() {
  const params = useParams<{ batch: string }>();
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<any[]>([]);

  const paperSize = (searchParams.get('paperSize') ?? '4x6') as PaperSize;
  const documentType = (searchParams.get('documentType') ?? 'waybill') as 'waybill' | 'packing_slip';
  const orderIds = params.batch.split(',');

  useEffect(() => {
    Promise.all(orderIds.map((id) => fetch(`/api/orders/${id}`).then((res) => res.json())))
      .then((results) => setOrders(results.map((r) => r.order)))
      .then(() =>
        fetch('/api/print-history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderIds, paperSize, documentType }),
        })
      );
  }, [params.batch]);

  useEffect(() => {
    if (orders.length > 0) {
      setTimeout(() => window.print(), 300);
    }
  }, [orders]);

  if (orders.length === 0) return <p className="p-6">Loading…</p>;

  return <PrintPreviewDocument orders={orders} paperSize={paperSize} documentType={documentType} />;
}
```

- [ ] **Step 4: Add the single-order fetch route it depends on**

```ts
// src/app/api/orders/[id]/route.ts
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { orders } from '@/db/schema';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [order] = await db.select().from(orders).where(eq(orders.id, id));
  if (!order) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ order });
}
```

- [ ] **Step 5: Manual verification**

Run: `npm run dev`, from an order detail page click "Print Waybill". Expected: new tab opens `/print/<id>?paperSize=4x6&documentType=waybill`, renders the order with a barcode and QR code, and the browser print dialog opens automatically; a row appears in `print_history` after the request completes.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add print preview document, print route, and print history logging"
```

---

## Task 18: Settings Pages + PWA Manifest

**Files:**
- Create: `src/components/store-connection-card.tsx`
- Create: `src/app/settings/page.tsx`
- Create: `src/app/settings/store/page.tsx`
- Create: `src/app/api/settings/route.ts`
- Create: `src/app/manifest.ts`
- Create: `public/icon-192.png`, `public/icon-512.png` (placeholder OmniShip icons)

**Interfaces:**
- Consumes: `AppShell` (Task 2), `db`/`stores`/`appSettings` (Task 3), `/api/auth/shopify/connect` (Task 6).
- Produces: `StoreConnectionCard` — `<StoreConnectionCard store={StoreRow | null} error={string | null} />`.

- [ ] **Step 1: Implement StoreConnectionCard**

```tsx
// src/components/store-connection-card.tsx
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface StoreConnectionCardProps {
  store: { name: string; shopDomain: string; status: string; lastError: string | null } | null;
  error: string | null;
}

export function StoreConnectionCard({ store, error }: StoreConnectionCardProps) {
  const [shop, setShop] = useState('');

  function connect(shopDomain: string) {
    window.location.href = `/api/auth/shopify/connect?shop=${encodeURIComponent(shopDomain)}`;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Shopify Store</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {store ? (
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-mono">{store.name}</span>
              <Badge variant={store.status === 'connected' ? 'default' : 'destructive'}>{store.status}</Badge>
            </div>
            {store.status === 'error' && (
              <div className="space-y-1">
                {store.lastError && <p className="text-destructive">{store.lastError}</p>}
                <Button size="sm" variant="outline" onClick={() => connect(store.shopDomain)}>
                  Reconnect
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex gap-2">
            <Input
              placeholder="your-shop.myshopify.com"
              value={shop}
              onChange={(e) => setShop(e.target.value)}
            />
            <Button onClick={() => connect(shop)}>Connect</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Implement the settings store page**

```tsx
// src/app/settings/store/page.tsx
import { AppShell } from '@/components/app-shell';
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
      <h1 className="text-2xl font-semibold mb-6">Store Connection</h1>
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
```

- [ ] **Step 3: Implement the settings (company profile) page + API route**

```ts
// src/app/api/settings/route.ts
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
```

```tsx
// src/app/settings/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function SettingsPage() {
  const [companyName, setCompanyName] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');

  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data.settings) {
          setCompanyName(data.settings.companyName ?? '');
          setCompanyAddress(data.settings.companyAddress ?? '');
        }
      });
  }, []);

  async function save() {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyName, companyAddress, defaultPaperSize: '4x6' }),
    });
    toast.success('Settings saved');
  }

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold mb-6">Company Profile</h1>
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Company Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Company name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
          <Input
            placeholder="Company address"
            value={companyAddress}
            onChange={(e) => setCompanyAddress(e.target.value)}
          />
          <Button onClick={save}>Save</Button>
        </CardContent>
      </Card>
    </AppShell>
  );
}
```

- [ ] **Step 4: Add the PWA manifest**

```ts
// src/app/manifest.ts
import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'OmniShip',
    short_name: 'OmniShip',
    description: 'Automated waybill printing for Shopify orders',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#f05223',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
```

Generate two placeholder PNG icons (solid `#f05223` square, 192x192 and 512x512) and save them to `public/icon-192.png` and `public/icon-512.png` — replace with a real OmniShip mark later.

- [ ] **Step 5: Manual verification**

Run: `npm run build && npm run start`, visit `/settings/store` and connect a Shopify dev store (requires the Shopify Partner app credentials and Supabase project from the design spec's Open Prerequisites), then visit `/settings` and save a company profile. Expected: both persist and reload correctly; Chrome's install icon appears in the address bar due to the manifest.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add settings pages and PWA manifest"
```
