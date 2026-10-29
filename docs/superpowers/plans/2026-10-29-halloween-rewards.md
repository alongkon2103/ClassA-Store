# Halloween rewards implementation plan

**Goal:** Complete the existing Home pumpkin UI with durable, real rewards and recognizable game covers.

**Confirmed rules:** One free draw per signed-in store account for the whole event. Opens 2026-10-30 00:01 +07:00, closes 2026-11-01 00:01 +07:00 (end exclusive). Points have 60% combined probability, split equally over 2,000 / 3,000 / 5,000; games have 40%, split equally over five games × 1 / 3 days. Games: Universe, Hyper Run, Jump EVO, Pig Panic, Slash.

**Architecture:** Server cryptographic draw and a new `halloween_draws` table with a unique event/account key. Points are credited atomically with the draw. Game results stay pending until claimed; Roblox claims use a server-verified canonical identity and desktop claims use the signed-in account. Claims atomically extend existing access and create a zero-value event order, making the reward visible to Orders and Tikkies. Retry/reload returns the stored result without awarding twice. Pending prizes remain claimable after the event closes.

**Constraints:** Reuse Prisma/PostgreSQL, NextAuth, Roblox lookup, existing art and Framer Motion. No payment, no new package, no changes to purchase fulfillment. No real customer test awards. Verify in a disposable schema before applying the additive event table.

## Tasks

- [x] Pin the schedule and exact 1,500-ticket probability distribution with assertions, then implement the shared event contract.
- [x] Add the table and draw/claim service; test actual PostgreSQL transactions in an isolated schema: concurrent requests, ownership, expiry extension, rollback, permanent access, and retries after close.
- [x] Add authenticated no-store API routes with same-origin and bounded JSON validation; test forged rewards, unauthorized calls and service errors.
- [x] Connect Home to real status/draw/claim, retain the separate labeled preview, show game covers and automatic Roblox identity/avatar verification, and add event labels to point history/admin filters.
- [x] Verify TypeScript, lint, event and existing theme/Tikkies tests; inspect desktop/mobile/loading/error/upcoming/result UI; apply only the tested additive table to the connected database.

## Review focus

Lost responses must not reroll or duplicate awards. Client-supplied prizes must be ignored/rejected. A Roblox outage must leave the prize claimable. Simultaneous claims for the same game/account must preserve added days. Date checks must use the server and Bangkok event boundaries; no dev date override in production.

## Execution record

- User authorized full implementation; continuing in the current checkout to preserve the existing uncommitted UI and Roblox changes.
- Database read confirmed all five intended products and real covers; Pig Panic is a desktop product, the other four use Roblox whitelist access.
- Added the tested, additive table to the connected database. Read-only audit confirmed zero real draws and zero leftover test schemas. No customer grants were used for testing.
- Fresh review found a paid-access race; reproduced it with a real row-lock interleaving, then fixed expiry extension with atomic SQL. Legacy whitelist checking now consistently selects the latest expiry across case variants, with a PostgreSQL regression fixture.
- Delayed client status reads started before or during a draw cannot erase the saved result; the UI regression closes and reopens during an outstanding draw.
- Passed event distribution/schedule, route validation, real PostgreSQL grant/concurrency/rollback, JSDOM UI flow, Tikkies entitlements/purchase points, reward gallery, redeem Roblox UI, existing Halloween theme checks, TypeScript, Prisma validation and ESLint (no errors; existing/image/async-effect warnings remain).
- Observed Home at 1280px and 390px, actual five game covers loaded, modal contained without horizontal overflow. Separate labeled demo showed AC Slash cover/name/one-day result. No production schedule override was added.
- Production build compiled, then exposed a preexisting invalid Page export `AFF_REF_KEY` in `/r/[code]`. Repository-wide reference search confirmed it has no importers; kept the constant private to that page so Next.js can type-check the route.
- Final `npm run build -- --webpack` passed, including Next.js Page types, all 297 static pages, optimization and build tracing. Existing multiple-lockfile workspace-root warning remains; no build bypasses were used.

## Operations

No new environment variables or packages are required. The event uses the existing NextAuth and PostgreSQL configuration. For another database, run `prisma/sql/20261029_halloween_draws.sql` in a transaction before deploying, then generate the Prisma client (`npx prisma generate`). The connected database already has the table. Pending game prizes remain claimable after the draw window; existing permanent access is preserved. Points appear as `earn_event` in the customer/admin ledger; games appear as zero-value `EVENT` orders. All reward choices and access writes run on the server. Code remains local until pushed/deployed.
