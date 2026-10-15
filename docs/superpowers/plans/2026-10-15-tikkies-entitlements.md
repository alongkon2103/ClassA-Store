# Tikkies Entitlements Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task; the user explicitly authorized implementation in the supplied specification. No production deployment or Git push.

**Goal:** Authenticated Tikkies backend can read exact customer/game/Roblox rights without changing the store's purchase ownership.

**Architecture:** Resolve customers only through existing accounts(provider, provider_account_id). Existing orders are stable entitlement sources and customer ownership proofs; intersect confirmed own grants with the current whitelist, never use a customer's latest Roblox name. Persist resolved Roblox IDs on orders, use products.id as permanent gameKey, and add admin-managed Universe/Place mapping. PostgreSQL triggers track source revisions/audit atomically, including existing writer paths; wall-clock expiry adds a deterministic revision step. Integration reads never call Roblox or mutate rights.

**Tech Stack:** Next.js 16 route handlers, Prisma 7/PostgreSQL, Node crypto, existing NextAuth, existing assert/JSDOM scripts. No new dependency or queue.

**Spec:** docs/superpowers/specs/2026-10-15-tikkies-entitlements.md

## Global Constraints
- Work only on the store/API; do not edit Tikkies or Roblox event receivers.
- No email/username-based customer matching, no automatic customer merging.
- OAuth and Roblox IDs are strings; times UTC ISO; only active unlocks.
- Authenticate before lookup; no-store; bounded input and shared rate limiting; no secrets or raw identities in logs.
- Additive schema/migration only. Do not apply this task's migration to production, deploy or push Git.
- External Roblox/payment requests run outside DB transactions; missing dependencies fail closed.

## Review Focus
- Same-email unlinked identities cannot acquire another customer's purchases.
- Multiple customers using one Roblox account must not share payment ownership.
- Refund/cancellation replay must not resurrect rights; global whitelist deletion must revoke reads immediately.
- Rename preserves saved Roblox ID; changing the purchased raw username invalidates an old binding.
- Expiry is checked on read and advances revision without relying on cron; unavailable sources return 503.

### Task 1: Add source metadata, revisions and audit
Files: prisma/schema.prisma; prisma/sql/20261015_tikkies_entitlements.sql; scripts/check-tikkies-db.ts.
- [x] Test additive migration in a separate PostgreSQL TEMP/schema fixture; assert legacy rows retained, update/no-op/rebind/whitelist/mapping changes advance revisions correctly.
- [x] Add order Roblox identity/binding snapshot fields, entitlement_revision and entitlement_updated_at; product Universe/Place fields; binding audit and rate buckets.
- [x] SQL triggers increment revisions on relevant order changes and invalidate stale bindings, fan out whitelist/product updates to affected orders, and audit Roblox changes. Add query indexes on customer/product/normalized IGN.
- [x] Generate Prisma client and run the fixture; never alter production tables during this task.

### Task 2: Strict read model and protected route
Files: lib/integrations/tikkies.ts; lib/integrations/tikkiesSecurity.ts; app/api/integrations/tikkies/entitlements/route.ts; scripts/check-tikkies-entitlements.ts; scripts/check-tikkies-route.ts.
Interfaces: parseIdentities(unknown) -> verified-shape identities; readEntitlements(db, identities, now) -> contract; code errors customer_not_found/identity_conflict/unavailable. Status evaluator consumes order/current whitelist/mapping/Roblox snapshot and returns active/pending/expired/revoked/refunded/account_unresolved.
- [x] Assert Google/Discord matches, conflict, missing/no-rights, same email never queried, expired/current grants, refunds, multiple accounts and missing mappings/bindings.
- [x] Read by accounts composite identity, then customer-scoped Roblox orders and a bounded batch of matching whitelist rows; no N+1 or global purchase scan. Preserve multiple game/account tuples; no matching via last username.
- [x] Protect route with env hashed Bearer credentials + rotation, explicit HTTPS/proxy policy, 8 KiB streamed body limit, <=10 identities, PostgreSQL global/per-subject minute buckets, Retry-After and safe structured logs.
- [x] Route tests cover auth before DB, invalid/large bodies, quotas, 404/409/503, no-store, exact response fields and redacted logs.

### Task 3: Persist Roblox identity and maintain mapping
Files: lib/integrations/tikkiesRoblox.ts; lib/orderFulfillment.ts; app/api/webhook/route.ts; app/api/checkout/trial/route.ts; app/api/admin/whitelist/route.ts; app/api/admin/whitelist/[id]/route.ts; admin product mapping panel and route; scripts/backfill-tikkies-roblox.ts.
- [x] Official username/ID lookup tests reject invalid/unsafe IDs, retain ID on rename, handle outages as unresolved, never perform network access inside a transaction.
- [x] Resolve new verified-payment grants before their existing transaction, and save snapshots with the grant. Preserve checkout success if Roblox is unavailable (unresolved fails closed in integration).
- [x] Admin whitelist edits use official Roblox resolution before transaction and set audit actor; an admin may correct by stable User ID. Existing authorization/policy stays intact.
- [x] Product editor shows stable products.id gameKey, Universe ID and distinct Place IDs, editable by admin with server validation. Mapping changes tracked by trigger.
- [x] Backfill defaults to dry-run; bounded cursor batches, fixed request spacing, rate-limit/backoff, CAS updates, optional by-ID refresh for rename; no guessing failed lookups, no raw customer identifiers in logs.

### Task 4: Verified reversals and synchronization
Files: lib/integrations/tikkiesReversal.ts; existing Stripe webhook; app/api/checkout/paypal/webhook/route.ts; existing admin order status route.
- [x] Tests assert signature/auth failure writes nothing, full/partial confirmed refunds revoke affected order, replay idempotence, paid replay never resurrects refunded/revoked orders, and independent paid grants survive.
- [x] Handle verified Stripe refund/dispute and PayPal verified refund/reversal events; map only gateway-owned references. No frontend status accepted as payment evidence.
- [x] Update the owned order/revision and existing points/commission reversals atomically; preserve independent grants in the shared whitelist (see ruling below).
- [x] Provide admin status support for verified offline/PayPal.me refunds; document that dashboard-only refunds need gateway event setup/manual reconciliation.

### Task 5: Regression, API documentation and handoff
Files: docs/integrations/tikkies.md; example env entries; targeted tests/scripts.
- [x] Document request/response, all statuses/errors, strict identity semantics, rotation/revocation, rate limits, no-store, mapping table, migration/backfill/rollback and verified gateway setup, cache <=60 seconds/fail closed on outages.
- [x] Run affected lint/typecheck, identity regression, discount regression and all new tests. Test DB triggers in isolated fixture, not production; browser-check admin panel with labeled fixture if authentication absent.
- [x] Independent security/scope review; fix findings and rerun relevant checks.
- [x] State external/provider/production tests not run; do not push, deploy, run production migration or silently backfill customer identities.


## Implementation rulings

- Reversals never rebuild or shorten the shared `(IGN, product)` whitelist from orders: it also contains independent AC Points/manual grants and has no customer/provenance key. The owned order's terminal state denies Tikkies access, while unrelated grants remain intact. Existing Roblox receivers and desktop program refunds remain outside this change. New reversal handling/admin refund controls apply to Roblox game orders only.
- Existing account linking by email remains an explicitly documented historical store-login policy, not a feature or identity fallback of this API. Exact stored OAuth IDs are the only customer lookup here.
- Existing owned orders are the entitlement unit. Standalone shared grants without an owned order and manual sales without `user_id` are not guessed into a customer. Admin must reconcile them explicitly. Existing own game-day rewards can extend the corresponding owned grant.
- No integration queue/outbox exists to reuse; API refresh is v1's synchronization model. No new infrastructure or dependencies were installed.

## Validation ledger — 2026-10-15

- PASS: `check-tikkies-entitlements.ts` — strict input including invalid provider types, exact Google/Discord/customer isolation, identity conflict, no rights, individual game/account tuples, source ambiguity, status/expiry/revision rules.
- PASS: `check-tikkies-route.ts` — auth before lookup, credential rotation, body cap, HTTPS, no-store/request ID, 404/409/429/503 and redacted logs.
- PASS: `check-tikkies-roblox.ts` — persisted IDs, by-ID rename, substitution rejection, outages/429.
- PASS: `check-tikkies-payments.ts` — verified Stripe/PayPal reversals, rejected signatures, early event retry, independent grants, refund replay and terminal paid/premium callback guards; no changes to desktop program orders.
- PASS: `check-tikkies-fulfillment.ts` — successful legacy grant/discount/points behavior with saved IDs, external lookup before transaction, Roblox outage does not lose purchase, reversal during lookup blocks granting.
- PASS: `check-tikkies-points.ts` — real award/reversal helpers under a serialized row-lock fixture, both refund-first and award-first orderings, duplicate-safe ledger/replay.
- PASS: `check-tikkies-admin.ts` — admin authorization, string mapping validation/deduplication, canonical by-ID correction and audit actor setup, provider outage, no external request inside transaction.
- PASS: `check-tikkies-backfill.ts` — actual CLI with fake DB/lookup, dry-run defaults/override, CAS, unresolved no-write and by-ID refresh.
- PASS: `check-tikkies-db.ts` — actual PostgreSQL via user's tunnel; isolated random schema in BEGIN/ROLLBACK, migration twice, preserved legacy row, no-op/relevant revisions, stale binding clearing/audit, source deletion/mapping changes, shared atomic rate bucket enforcement/reset. All fixture data and DDL rolled back; production tables were not migrated.
- PASS: existing `check-auth-identity.ts`, `check-discount-scope.ts`, `check-affiliate-code-api.ts`, `check-affiliate-code-ui.ts`.
- PASS: Prisma client generation and route type generation. Typecheck and affected lint are checked again after final edits; see final result below.
- Browser observed: actual Tikkies mapping component in a clearly labeled temporary data fixture, desktop 1126×720 and 1280×720 plus mobile 390×844; no horizontal overflow at 390px; read-only Game Key, editable IDs, disabled saving state, 403 error message and re-enabled save button. No admin authentication bypass or real product write. Mobile button layout adjusted to keep its label on one line. Temporary route removed and viewport reset. Screenshots saved outside repository.
- Independent security review found and resolved shared-grant destruction, early reversal loss, late points award and provider coercion issues. No remaining blocking finding after the parser fix; staging/gateway acceptance remains necessary.
- Not run: full production build (requires migrated schema/external configuration), real OAuth/Roblox/gateway payment-refund acceptance, staging load/production rollout, production migration, customer backfill, Git commit/push or deployment.

Final checks: PASS `npx tsc --noEmit` after removing only the generated type of the deleted UI fixture; PASS affected/new-file ESLint (zero errors, existing warnings in legacy image/effect/unused imports); PASS `git diff --check`. Independent reviewer approved the final strict parser, Roblox-only reversal scope, duplicate-payment guard and pending-only expiry updates, and reran model/payment/fulfillment fixtures successfully. Actual PostgreSQL fixture with shared quotas passed again with full rollback. No production schema migration or customer backfill was run.
