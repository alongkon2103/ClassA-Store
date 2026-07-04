# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> The line above is not decoration: **Next.js here is 16.2.4 and diverges from
> older App Router conventions.** Read the relevant guide under
> `node_modules/next/dist/docs/` before writing routing, params, or server/client
> boundary code. Route `params` are Promises (`await params`), `runtime = "nodejs"`
> is set explicitly on routes that need Node APIs.

## Commands

```bash
npm run dev            # next dev (http://localhost:3000)
npm run build          # next build — the real typecheck+lint gate (no separate tsc script)
npm run lint           # eslint (flat config; some pre-existing `any`/effect warnings exist)
npx tsc --noEmit -p tsconfig.json   # fastest full typecheck without building

# Prisma is schema-first — there is NO prisma/migrations dir; never `prisma migrate`.
npx prisma db push     # apply prisma/schema.prisma changes + regenerate client
npx prisma generate    # regenerate client only
npx prisma validate && npx prisma format

# Standalone scripts & the payment worker run via tsx with Node's --env-file:
npx tsx --env-file=.env scripts/<name>.ts
npx tsx --env-file=.env worker/paypalWorker.ts     # dev
pm2 start ecosystem.paypal-worker.config.js        # production (separate process)
```

There is **no test framework** (no jest/vitest). "Testing" here means writing a
throwaway `scripts/_name.ts`, running it with `npx tsx --env-file=.env`, asserting
against the real DB, and deleting it (see any `_`-prefixed script pattern in git
history). Always clean up temp scripts.

## Environment & runtime shape

- Runs behind **IIS on a Windows VPS**, managed by **PM2**, fronted by Cloudflare.
  The Next.js web app and the PayPal worker are **separate PM2 processes on
  purpose** — do not merge long-running work into the web app.
- **PostgreSQL** via Prisma 7 using `@prisma/adapter-pg` (a `pg.Pool`, not Prisma's
  own engine). The client is a global singleton in `lib/prisma.ts`.
- Secrets live in `.env`; scripts/worker load it with `--env-file` (needs Node ≥ 20.6).
- A Discord bot API is expected at `http://localhost:3700` for role assignment.
- An external `tiktok-service` (Node + WebSocket) and Roblox game servers call in;
  see `SYSTEM_FLOW.md` for that cross-service picture.

## Architecture

**Localized App Router.** Everything user-facing lives under `app/[locale]/`
(`en`/`th`) with `next-intl`. Routing helpers come from `@/i18n/routing` (`Link`,
`useRouter`, `redirect`) — import from there, not `next/navigation`, so locale
prefixes are handled. UI strings are in `messages/{en,th}.json`; keep both in sync.
`proxy.ts` is the next-intl middleware.

**Auth & admin.** `next-auth` (Discord + Google) via `lib/auth.ts`. Admin pages
under `app/[locale]/admin/` are gated in `app/[locale]/admin/layout.tsx` (roles
`admin`/`partnership`) with the sidebar in `components/admin/AdminNav.tsx`. Admin
API routes gate with `validateAdmin()` from `lib/adminAuth.ts`.

**Payments converge on one fulfillment path.** Multiple methods create an
`orders` row, and paid orders all funnel through **`fulfillPaidOrder(orderId)`**
in `lib/orderFulfillment.ts` (idempotent: no-ops if already `paid`). That helper
is the single place that flips the order to `paid`, upserts the whitelist row, and
best-effort assigns the Discord role. Methods:
- **Stripe** (card/promptpay) — `app/api/checkout/`
- **PayPal REST API** — `app/api/checkout/paypal/` (+ `lib/paypal.ts`)
- **PromptPay slip** — `app/api/orders/[id]/upload-slip` (QR + EasySlip verify)
- **PayPal.me email-verification** — see below
Per-method enable/fee config is in `lib/paymentConfig.ts` (backed by
`system_configs`, 30s cache); the product modal and checkout both read it.

**Whitelist = the product.** `user_whitelist_access` (unique `[ign, product_id]`,
no `user_id`) is the **single source of truth** the desktop client checks via
`POST /api/whitelist/check`. Permanent access is the year-9999 sentinel
(`isPermanentExpiry` / `PERMANENT_EXPIRES_AT` in `lib/formatExpiresAt.ts`). Orders
mirror ign/product/premium/expiry but are NOT the source of truth; when editing a
whitelist row, matching orders must be synced by (`whitelisted_username`,
`product_id`) since there's no FK.

**PayPal.me email-verification flow** (no PayPal Business API). A standalone PM2
worker (`worker/paypalWorker.ts`) polls a Gmail inbox for PayPal "money received"
emails, verifies DKIM/SPF + sender (`lib/paypalMailVerify.ts`), parses the Thai
template (`lib/paypalMailParse.ts` — match on GROSS, never the "รวม"/net line),
and matches by exact unique USD amount (`lib/paypalMatcher.ts`) before calling
`fulfillPaidOrder`. Orders freeze a unique `expected_amount` (converted price +
random cents); unmatched payments land in an admin review queue
(`app/[locale]/admin/paypal-review/`). `paypal_payments.txn_id` is UNIQUE for
idempotency. The worker also sweeps expired orders in-process.

## Data & serialization gotchas

- **Prisma `Decimal` cannot cross the server→client boundary.** Any server
  component/route that spreads a full order (`...o`) into a Client Component must
  convert every Decimal (`amount`, `discount_amount`, `expected_amount`, variant
  `price`) to `Number`, or Next throws "Only plain objects... Decimal not
  supported". Grep for existing `amount: Number(o.amount)` sites when adding a new
  order-to-client path.
- Schema changes: edit `prisma/schema.prisma` then `npx prisma db push`. New
  columns should be nullable so existing flows (Stripe/PayPal/slip) don't break.
- `paypal_me` payment method defaults to **off**; enable it (and set the
  PayPal.me link/fee) in Admin → Settings, which writes `system_configs`.
