# OmniShip — Phase 1 Design Spec

**Date:** 2026-08-06
**Status:** Approved for planning
**Source PRD:** OmniShip – Automated Waybill Printing Platform v1.0

## Context & Scope

The full PRD describes a multi-tenant SaaS platform integrating Shopify, TikTok Shop, and Shopee, with real-time sync, RBAC, multi-store/multi-company support, hardware printer integration, barcode/QR, notifications, and reporting. That scope spans multiple independent subsystems and is too large for a single design/implementation pass.

**This spec covers phase 1 only:** a single-tenant Next.js PWA with one real marketplace integration (Shopify), covering the core order-to-print pipeline. Everything else in the PRD (TikTok/Shopee integrations, RBAC/multi-store, hardware printer agents, notifications, reports, auto-print mode) is explicitly deferred to later phases/specs.

### Phase 1 goals
- Connect one Shopify store via OAuth.
- Sync orders automatically (polling + webhooks) and manually.
- Browse/filter/search orders on a dashboard and order list.
- Print waybills and packing slips (with barcode/QR) for one or many orders via the browser print dialog, sized to 4x6/A6/A5/Letter.
- Log print history.
- Basic PWA installability.

### Explicitly out of scope for phase 1
- TikTok Shop / Shopee integrations.
- Multiple stores, multiple companies, store switcher.
- Roles/permissions (Owner/Manager/Staff/Viewer) — single Supabase Auth user only.
- Direct USB/Bluetooth/network thermal printer drivers or a local print agent — printing goes through the OS/browser print dialog.
- Auto-print mode, warehouse scan workflows.
- Browser notifications (new order/sync failed/printer offline/etc.).
- Reports module and CSV/Excel/PDF export.
- Redis/BullMQ job queue — sync runs as plain Route Handlers + Vercel Cron.
- Audit logs, 2FA, session management beyond Supabase Auth defaults.

## Branding

Reuses the NexxaByte design system observed in the user's other projects:
- Primary color: `#f05223` (light mode) / `#f56a41` (dark mode).
- Neutral/background scale via oklch tokens (Tailwind v4 `@theme inline`).
- Font: Geist Sans (UI) + Geist Mono (codes/numbers).
- shadcn/ui: `base-nova` style, `neutral` base color, `lucide` icons.
- Border radius: `0.625rem`.
- The app has its own "OmniShip" product wordmark/lockup (not the NexxaByte company logo), using the same color system for consistency across the user's projects.

## Stack & Architecture

- Next.js 15 (App Router), TypeScript, Tailwind v4.
- shadcn/ui (`base-nova`, `neutral`, `lucide`), Geist fonts.
- Supabase: Postgres (data) + Auth (single-user login). No RLS multi-tenancy needed yet.
- Drizzle ORM for schema/migrations.
- Hosting: Vercel (app + API routes + Cron), Supabase (DB/Auth).
- No queue/worker infrastructure in phase 1.

```
Shopify Admin API ──(OAuth)──> Route Handlers ──> Postgres (orders, stores, print_history)
        │                                              │
   Webhook (orders/create,updated) ─────────────────────┘
        │
Vercel Cron (every 5 min) ──> /api/cron/sync-shopify ──> shared sync function
        │
Dashboard/Orders UI ──> select orders ──> /print/[batch] HTML view ──> window.print()
```

### Printing approach

Waybills and packing slips render as print-optimized HTML (CSS `@page` sized to the target paper size), with barcodes/QR codes drawn client-side via `jsbarcode`/`qrcode` (no external service calls, no server-side PDF engine). "Print All"/"Print Selected" renders every chosen order as a section with CSS page-breaks in a single HTML document, opened at `/print/[batch]`, which auto-triggers `window.print()`. The browser's native "Save as PDF" satisfies the PDF-generation requirement without a server rendering layer. Print history logs *what* was printed (order IDs, user, timestamp, paper size, document type) rather than storing the rendered file — content is deterministic and can be regenerated on demand from order data.

*Deferred:* server-side PDF generation with persisted, byte-identical files in Supabase Storage — revisit if phase 1 usage shows a real need for immutable print artifacts.

## Data Model

```
stores
  id, name, platform ('shopify'), shop_domain, access_token (encrypted),
  status ('connected'|'error'|'disconnected'), last_synced_at, last_error, created_at

orders
  id, store_id (fk), platform_order_id, order_number, customer_name,
  phone, address (jsonb), items (jsonb: sku, title, qty),
  courier, tracking_number, shipping_fee, payment_method,
  status ('pending'|'ready_to_ship'|'printed'|'packed'|'shipped'|'cancelled'),
  notes, raw_payload (jsonb), synced_at, created_at

print_history
  id, order_ids (jsonb array), printed_by (user_id), paper_size,
  document_type ('waybill'|'packing_slip'), printed_at

app_settings
  id, company_name, company_logo_url, company_address, tax_info,
  default_paper_size, default_courier
```

Notes:
- `access_token` encrypted at rest (Supabase Vault or app-level AES-GCM).
- `orders.status` is locally owned for `printed`/`packed`; Shopify-reported fulfillment state feeds the rest.
- Schema supports more than one `stores` row; phase 1 just has no UI to add a second one.

## Pages & Components

**Routes**
- `/login` — Supabase Auth.
- `/` — Dashboard: today's orders, status counts (waiting/ready/printed/shipped/cancelled/failed-sync), sales today, last sync time, manual "Sync Now".
- `/orders` — Filterable/sortable order list with bulk selection.
- `/orders/[id]` — Order detail + single print actions.
- `/print/[batch]` — Print-only HTML view (order IDs + paper size via query), auto-`window.print()`.
- `/settings` — Company profile, default paper size/courier.
- `/settings/store` — Shopify OAuth connect/reconnect + connection status.

**Key components:** `OrderTable`, `OrderFilters`, `PrintPreviewDocument` (shared by on-screen preview and `/print/[batch]`), `BarcodeBlock`/`QRBlock`, `SyncStatusIndicator`, `StoreConnectionCard`.

**API routes:** `GET/POST /api/orders`, `POST /api/sync/shopify`, `POST /api/cron/sync-shopify` (cron-secret protected), `POST /api/webhooks/shopify/orders` (HMAC-verified), `POST /api/print-history`, `GET/POST /api/settings`, `GET /api/auth/shopify/callback`.

## Sync Mechanics

Shared sync function used by cron, webhook, and manual button:
1. Fetch orders from Shopify Admin API filtered by `updated_at_min` = last successful sync.
2. Upsert into `orders` by `platform_order_id`; preserve local-only status advances (e.g. don't regress `printed` back to `pending`).
3. Update `stores.last_synced_at` on success; on failure set `stores.status = 'error'` with `last_error` message.
4. Webhook path processes a single order payload immediately after HMAC verification, bypassing the polling window.

## Error Handling

- Expired/revoked Shopify token → `stores.status = 'error'`, Settings shows "Reconnect" CTA, dashboard shows a "Failed Sync" count.
- Shopify 429 → exponential backoff in the sync function; cron retries next interval.
- Print with no orders selected → button disabled, not a silent no-op.
- OAuth callback failure → redirect to `/settings/store?error=...` with a readable message.
- API routes return typed `{ error: string }` JSON with correct status codes; UI surfaces via shadcn `Toast`.

## Testing Plan

- **Unit:** sync upsert/merge logic, status-preservation rule, barcode/QR data encoding, filter/sort query building.
- **Integration:** Route Handlers for sync/webhook/print-history against a test Postgres (Supabase local dev), including webhook HMAC verification.
- **Manual/E2E:** Shopify dev store OAuth connect, trigger sync, print single + bulk batch, confirm print history, confirm reconnect flow after revoking the token.
- No automated visual testing of print output in phase 1 — verified by hand.

## Open Prerequisites (not part of this spec's implementation, but required before build)

- A Shopify Partner account + dev store, and a Shopify app (API key/secret) for OAuth — user to provide.
- A Supabase project (URL + anon/service keys) — user to provide or approve creation of.
