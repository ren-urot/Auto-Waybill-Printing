# OmniShip

Automated waybill and packing-slip printing for Shopify orders. Next.js (App
Router) + Supabase Auth/Postgres + Drizzle. Phase 1 covers one Shopify store:
OAuth connect, order sync (cron + webhook + manual), an order list, and
browser-based bulk printing.

## Setup

- Copy `.env.example` to `.env.local` and fill it in. `DATABASE_URL` and
  `TOKEN_ENCRYPTION_KEY` must be set before anything imports `src/db/client.ts`
  — it throws at import time if they're missing, so `npm run build` and the
  test suites need them too.
- Generate `TOKEN_ENCRYPTION_KEY` with `openssl rand -base64 32`. It encrypts
  the stored Shopify access token at rest.
- Apply the schema: `npm run db:migrate` (run it against each environment's
  database; `npm run db:generate` creates a new migration after a schema edit).
- `npm run dev` to start the app, `npm test` for unit tests, and
  `npm run test:integration` for the Postgres-backed tests (they expect a test
  database on `localhost:5433` — e.g.
  `docker run --rm -d -e POSTGRES_PASSWORD=test -e POSTGRES_DB=omniship_test -p 5433:5432 postgres:16`,
  then `npm run db:migrate` pointed at it).

## Shopify app configuration

Create an app in the Shopify Partner dashboard, then set `SHOPIFY_API_KEY`,
`SHOPIFY_API_SECRET`, and `SHOPIFY_APP_URL` from it. Two things must be
registered on the Shopify side or the integration silently does nothing:

- **OAuth redirect URL** — add `<SHOPIFY_APP_URL>/api/auth/shopify/callback` to
  the app's allowed redirection URLs. The connect flow starts at
  `/api/auth/shopify/connect?shop=your-shop.myshopify.com`.
- **Webhook subscription** — subscribe the `orders/create` and `orders/updated`
  topics to `<SHOPIFY_APP_URL>/api/webhooks/shopify/orders`. Payloads are
  HMAC-verified with `SHOPIFY_API_SECRET`; without it set, every webhook is
  rejected.

## Scheduled sync

`vercel.json` schedules `GET /api/cron/sync-shopify`. The route requires
`Authorization: Bearer $CRON_SECRET` and rejects everything when `CRON_SECRET`
is unset, so set it in the deployment environment.
