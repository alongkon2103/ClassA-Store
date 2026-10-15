# Tikkies Games — store entitlement API v1

This integration is read-only and server-to-server. It covers this store's `roblox_whitelist` products, uses existing purchases and grants, and does not change Tikkies or Roblox event receivers. No queue or second order/subscription system is introduced.

## Identity and ownership contract

| API field | Existing source / rule |
| --- | --- |
| OAuth identity | Exact `accounts(provider, provider_account_id)` from Google/Discord login; both IDs are strings. The composite unique index already exists. |
| `customerId` | Existing immutable `users.id` UUID. |
| `entitlementId` | Existing immutable `orders.id` UUID; renewals/new purchases can create additional entries. |
| `gameKey` | Existing immutable `products.id` UUID, **not the mutable slug/name**. Configure the same key in Tikkies. |
| `universeId` / `placeIds` | Admin-managed separate fields on `products`; decimal strings. A Universe contains places; IDs are not interchangeable. |
| Roblox binding | Persisted `orders.roblox_user_id`, canonical username/display name and `roblox_resolved_for`, the normalized purchased IGN snapshot. |
| Active rights | This customer's confirmed paid/Admin Buy order, its current status/expiry, the matching current whitelist row, resolved Roblox binding and complete game mapping. |
| Own AC Points extensions | This customer's `game_days` redemptions may extend their existing order's expiry for the same game/IGN; still capped by current whitelist expiry. |
| Revision/audit | SQL triggers update per-order revision/time and record changed Roblox bindings. Wall-clock expiry adds a deterministic revision step at read. |

Tikkies must send identities obtained from **its verified OAuth session**, never from a user-entered ID. Possession of the integration credential is the trust boundary: the store cannot verify Tikkies' end-user session from a provider ID alone. Keep this credential exclusively on Tikkies backend.

This endpoint never looks up email, display name, or Roblox username to identify a customer, and never merges customers. If supplied identities belong to different customers, it returns `409 identity_conflict`. Unknown identities return `404 customer_not_found`; ask the user to use their original provider or complete a separately verified account-linking process. A matched identity plus an unknown one returns the matched customer's rights with `identity_link_required` warning; the unknown identity is **not** linked.

**Existing login caveat:** the store's normal login currently links a newly seen provider to an existing user by matching email (`lib/authIdentity.ts`, `lib/auth.ts`). This API uses the already stored account links and does not independently establish how historical links were created. This change preserves existing login behavior; it does not claim those historical links were all explicitly user-approved. Audit or redesign that login policy separately before relying on stricter cross-provider ownership guarantees.

## Request

`POST /api/integrations/tikkies/entitlements`

Required headers: `Authorization: Bearer <integration-secret>`, `Content-Type: application/json`. Production requires HTTPS. No browser cookie or shop session substitutes for this credential.

```json
{
  "identities": [
    { "provider": "google", "providerAccountId": "example-google-sub" },
    { "provider": "discord", "providerAccountId": "123456789012345678" }
  ]
}
```

Only `google` / `discord`, 1–10 entries before deduplication, exact allowed keys. IDs must be strings of 1–255 ASCII letters, digits, `.`, `_`, `:`, `-`; exact case-sensitive comparison. Duplicate pairs are deduplicated. Maximum body is 8,192 bytes, checked both by declared length and actual streamed bytes. Unknown fields and numeric IDs are rejected.

Example from Tikkies backend (environment populated by a secret manager):

```sh
curl --fail-with-body --request POST "$STORE_ORIGIN/api/integrations/tikkies/entitlements" \
  --header "Authorization: Bearer $TIKKIES_STORE_TOKEN" \
  --header 'Content-Type: application/json' \
  --data '{"identities":[{"provider":"google","providerAccountId":"example-google-sub"}]}'
```

Do not run with shell tracing, capture Authorization in access logs, or put the token in URLs/frontend bundles.

## Response

All responses have `Cache-Control: no-store` and server-generated `X-Request-Id`. Errors include the same request ID in JSON. Example values below are fictional.

```json
{
  "schemaVersion": 1,
  "customerId": "11111111-1111-4111-8111-111111111111",
  "checkedAt": "2026-10-15T10:00:00.000Z",
  "entitlements": [{
    "entitlementId": "22222222-2222-4222-8222-222222222222",
    "gameKey": "33333333-3333-4333-8333-333333333333",
    "gameName": "Example Game",
    "universeId": "1234567890",
    "placeIds": ["9876543210"],
    "status": "active",
    "expiresAt": null,
    "updatedAt": "2026-10-15T09:00:00.000Z",
    "revision": 3,
    "roblox": { "userId": "1122334455", "username": "ExamplePlayer", "displayName": "Example Player" }
  }]
}
```

All dates are UTC ISO 8601. `expiresAt: null` means permanent (legacy year-9999 expiry is normalized). Effective expiry is the earlier of the customer's own grant expiry and current matching whitelist expiry. Multiple purchases/game/account combinations remain separate entries; never apply a customer's most recent Roblox name to all games. Tikkies can deduplicate **active** choices by `(gameKey, roblox.userId)`, while retaining every source entitlement ID.

A full response replaces the previous snapshot. Missing entries must be removed, including when a product is no longer Roblox or an order was deleted. Revision is a monotonically increasing per-entitlement number, not a contiguous global sequence: stored revision is encoded as `2 * sourceRevision - 1`, plus one after effective expiry. `updatedAt` becomes the expiry instant when it changes the result after the last source update. Do not compare revisions between different entitlement IDs. The reader does not write on expiry or call Roblox.

| Status | Meaning |
| --- | --- |
| `active` | The **only** status permitted to unlock a game. |
| `pending` | Unconfirmed payment/fulfillment, or missing game mapping. Mapping issues include `resolution: {reason: "game_mapping_required", orderId}`. |
| `expired` | Order explicitly expired, whitelist marked expired, or effective expiry reached at read time (no cron required). |
| `revoked` | Cancelled/revoked/disputed order, removed/revoked/suspended whitelist status, or the corresponding whitelist row no longer exists. |
| `refunded` | The specific order has a verified/admin-recorded refund. Takes precedence over other states. |
| `account_unresolved` | Active-looking source but missing/stale Roblox binding. Includes `resolution: {reason: "roblox_identity_required", orderId}`. |

`roblox.userId`, username/display name, or universe ID may be null in non-active entries. Display fields are snapshots; they are not proof of Roblox account ownership. Never offer non-active entries as usable account choices. Administrators can use the order ID to find and repair unresolved records.

| HTTP | Error / behavior |
| --- | --- |
| 200 | Known customer, including `entitlements: []` when there are no owned Roblox orders. |
| 400 | `invalid_input`, `body_too_large`. |
| 401 | `unauthorized`: absent/invalid integration credential. |
| 403 | `integration_disabled`, `https_required`. |
| 404 | `customer_not_found`; `action: "use_original_provider_or_link_accounts"`. |
| 409 | `identity_conflict`; do not merge or combine rights. |
| 429 | `rate_limited`, with `Retry-After` seconds. |
| 503 | `integration_unavailable`, `entitlements_unavailable`, `entitlement_capacity_exceeded`, `entitlement_source_conflict`. Dependency/configuration/ambiguous-data failures are **not** empty rights. |

The endpoint authenticates before customer lookup and reads all entitlement sources in one repeatable-read transaction. Queries are customer-scoped and batched: no global purchase scan or per-order Roblox call. Safety caps: 5,000 owned orders, 5,000 own game-day redemptions, 10,000 candidate whitelist rows; exceeding them returns 503 rather than truncating rights. Ambiguous case-variant whitelist duplicates also return 503 for admin reconciliation.

## Configuration and credential lifecycle

See [tikkies.env.example](./tikkies.env.example) for placeholders. No real integration credential was generated or stored by this implementation.

| Variable | Required/default |
| --- | --- |
| `DATABASE_URL` | Existing PostgreSQL connection. |
| `TIKKIES_API_ENABLED` | Must be exactly `true`; otherwise authenticated calls return 403. Leave false until migration/mapping/backfill are reviewed. |
| `TIKKIES_API_KEY_SHA256` | Required SHA-256 hex digest of a dedicated random token. Store receives only the digest. |
| `TIKKIES_API_KEY_PREVIOUS_SHA256` | Optional previous digest during rotation. Remove to revoke that credential. |
| `TIKKIES_TRUST_PROXY` | Default false. True only behind a trusted ingress that strips/overwrites incoming `X-Forwarded-Proto` and prevents direct backend access. |
| `TIKKIES_RATE_LIMIT_PER_MINUTE` | Default 6000 shared integration requests / 60 seconds. |
| `TIKKIES_CUSTOMER_RATE_LIMIT_PER_MINUTE` | Default 60 requests / exact sorted identity set / 60 seconds. Not an IP limit; users behind the same Tikkies backend IP do not share this bucket. |
| `PAYPAL_WEBHOOK_ID` | Required for the new verified PayPal reversal webhook, from the correct sandbox/live merchant app. |
| `PAYPAL_BASE_URL`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | Existing PayPal server configuration. Base defaults to sandbox. Use matching live configuration in production. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Existing Stripe server configuration, with subscriptions below. |

Generate at least 32 random bytes in a secret manager, encode as base64url (32–256 URL-safe characters), give plaintext only to Tikkies backend, and configure its SHA-256 digest on the store. Do not commit or log plaintext. Token comparison is constant-time. Deploy/restart all instances after config changes. Rotation: put old current digest in PREVIOUS, set new current digest, update Tikkies token, verify, then remove PREVIOUS. Emergency revocation: disable integration or replace/remove the relevant digest on every instance. No frontend management endpoint can issue or change credentials.

Quotas are atomic PostgreSQL buckets shared across app instances, not in-memory/IP quotas. Buckets contain a constant global hash and keyed hashes of identity sets, never raw provider IDs. Previous/current credentials use the same current hash as quota key material during overlap. Rotation changes subject buckets; the global bucket remains. Values must be integers 1–1,000,000. Monitor 429/latency and size the global quota for real simultaneous users. Bounded indexed cleanup removes old buckets; reverse-proxy body/request timeouts should also be configured. Logs contain only request ID, outcome/status and elapsed milliseconds; exclude request/response bodies and Authorization at infrastructure level too.

## Purchase, renewal, reversal and Roblox binding

New Stripe, shared PayPal/PayPal.me fulfillment, trial grants and admin whitelist grants resolve Roblox usernames through the [official Roblox Users API](https://create.roblox.com/docs/cloud/reference/domains/users) **before** their grant transaction. A 3-second lookup outage does not break payment: the purchase completes with an unresolved binding and cannot unlock Tikkies until repaired. Read requests never perform external lookups. Existing saved User IDs are preserved on retries and refreshed by ID, not by a renamed username.

SQL triggers cover relevant order mutations, whitelist insertion/edit/deletion, product mapping/name/type changes and admin rebinds. Changing a raw purchased username without a matching new resolved snapshot clears the old binding, fails closed, increments revision and writes `roblox_binding_audit`. Admin whitelist changes retain the store's existing policy: editing one `(IGN, game)` row updates **all matching orders**, not only one customer. The admin-only optional Roblox User ID field resolves its canonical username via Roblox before transaction, sets the audit actor, and supports rename/repair. This lookup verifies account existence, **not ownership**; follow the store's existing verification policy before changing a customer's account. Automated backfill audit actor is null.

For Roblox game orders, verified Stripe `charge.refunded` and `charge.dispute.created` events update the affected order and reverse existing points/affiliate earnings atomically. Any positive partial refund conservatively revokes that order's complete game entitlement; no proportional-days policy is guessed. Disputes remain revoked pending manual review; dispute-win restoration is not automatic. Terminal reversed orders cannot be reopened by payment callback replay or the admin paid toggle; grant a reviewed new order if needed. The points award checks eligibility and writes the ledger while holding the same order row lock as reversal, preventing late awards after refund.

Stripe uses the stored payment intent, falling back to the verified checkout session ID for early/legacy events. Premium add-on refunds do not revoke the base game. Configure the existing endpoint `/api/webhook` for `checkout.session.completed`, `checkout.session.expired`, `charge.refunded`, `charge.dispute.created` and verify the endpoint signing secret. [Stripe event reference](https://docs.stripe.com/api/events/types).

New `/api/checkout/paypal/webhook` verifies the transmission with PayPal's signature verification API before any order access. Subscribe to `PAYMENT.CAPTURE.REFUNDED` and `PAYMENT.CAPTURE.REVERSED`, matching the configured merchant environment/webhook ID. Verified gateway capture/order references map the order. Missing/unmapped relevant references return 503 so delivery can retry if refund arrives before capture association. Failed verification writes nothing; verification outages return 503. Unknown verified event types are acknowledged. [PayPal webhook verification](https://developer.paypal.com/api/rest/webhooks/rest/), [PayPal events](https://developer.paypal.com/payment-methods/webhooks/).

PayPal.me/offline Roblox game refunds do not produce this PayPal Orders webhook: an admin must reconcile the actual completed refund and use **Record completed refund** on the order. This is an authenticated operator decision and is noted with actor/time in `manual_note`; it never sends money or treats a shopper's status payload as proof. Unmapped gateway events need monitoring/reconciliation if retries expire (including refunds for transactions not belonging to this store's orders). No new refund-money API was added.

**Shared source limitation:** legacy `user_whitelist_access` is shared by `(IGN, product)` and contains no customer/grant provenance. Reversing one order deliberately does **not** shorten/delete that shared row: it could destroy another customer's purchase, AC Points extension or manual grant. The Tikkies API denies the refunded owned order independently. Existing legacy Roblox checks and desktop-program access have their existing behavior; this task does not rewrite those receivers or reconcile their shared provenance. A standalone AC Points/manual shared grant **without an owned order** is not exported, and manual sales with `user_id = null`/buyer labels are not attached by email/name. Review those records with the store operator before granting Tikkies access. Separate owned grants/orders survive a refund.

## Installation and backfill (operator steps; not performed on production)

1. Take a database backup and inspect the additive [SQL migration](../../prisma/sql/20261015_tikkies_entitlements.sql). Apply it **before deploying generated Prisma/client code**, in the intended application schema, during a maintenance window. Do not use `prisma db push` as a substitute: it does not install revision/audit triggers or functional indexes. No migration tracking system is introduced.
2. Run once with transaction/error stop, for example `psql "$DATABASE_URL" --set ON_ERROR_STOP=1 --single-transaction --file prisma/sql/20261015_tikkies_entitlements.sql`. It is idempotent and preserves existing customer rows. Index creation and table alterations acquire locks; schedule for the store's traffic/size. Do not change the search path to an untrusted schema.
3. Generate the Prisma client (`npx prisma generate`), deploy the reviewed code with integration disabled, then configure gateway webhook events/secrets.
4. In Admin → Products → edit a Roblox game → **Tikkies game mapping**, copy its read-only Game Key and enter the official Universe ID and allowed Place IDs. IDs stay separate; admin must confirm those places belong to that universe. Missing mapping stays pending. Only full admins can edit mapping; generic product updates cannot bypass this.
5. Preview legacy Roblox resolution, starting with a few reviewed orders. The following commands access real customer data and Roblox; run only as an authorized operator, not during normal request handling:

```sh
node --import tsx scripts/backfill-tikkies-roblox.ts --dry-run --limit=20 --delay-ms=1000
node --import tsx scripts/backfill-tikkies-roblox.ts --apply --limit=20 --delay-ms=1000
# Resume using the previous output's nextCursor:
node --import tsx scripts/backfill-tikkies-roblox.ts --dry-run --after=<order-uuid> --limit=100
# Refresh a renamed, previously bound account by its saved User ID:
node --import tsx scripts/backfill-tikkies-roblox.ts --dry-run --refresh --order-id=<order-uuid>
```

Backfill defaults to dry-run; explicit dry-run overrides apply. Limits 1–5000 rows/run, minimum spacing 350ms, default 1000ms, bounded three attempts with Retry-After on Roblox 429, per-run lookup deduplication. Missing/failed accounts are reported unresolved and never guessed or overwritten. Apply uses compare-and-set on the original IGN/ID/snapshot so concurrent admin edits are skipped; repeat runs are safe. Keep review output private (order IDs/Roblox IDs), not in shared application logs. Resolve changes through Admin → Whitelist optional User ID, following verification policy. Audit, inspect unresolved records, and verify the dry-run before applying. Do not resolve a historically renamed username by guessing its new owner; use verified stable ID when known.
6. Enable the API, provision the credential to Tikkies backend, and run sandbox/staging acceptance cases before opening access to customers.

Read deployment order matters: the generated Prisma model selects added columns, so deploying code before migration can break existing pages querying full order/product records. Migration does not resolve old accounts or guess Universe/Place mappings. Keep integration disabled until prerequisites are ready.

## Tikkies refresh and failure policy

Check on entering Games, before connecting/starting a game, and periodically while connected. Recommended maximum cache lifetime is **60 seconds**, and never beyond `expiresAt`. Refresh all active account choices from the complete snapshot. Revocation may lag by that refresh interval. Honor Retry-After with jitter/backoff, show a verification/service-unavailable state, and stop relying on cached rights when the 60-second freshness/expiry deadline is reached. A 503 must never be treated as `[]`, permanent ownership, or permission to keep using stale rights indefinitely. Request IDs help support correlate failures without sending OAuth IDs/tokens.

## Rollback

Disable integration and revoke credentials first. Stop backfill and revert the application code/client together to the previous release. **Keep the additive columns, audit rows and rate table** so bindings/history are preserved. They are inert to old application code. If necessary, after all new code is removed, drop only the three `tikkies_*_revision_trigger` triggers from orders, products and user_whitelist_access (and their three functions) in a reviewed transaction; retain data. Old payment code may not understand terminal refunded states—reconcile affected orders before restoring its payment callbacks. Never reset/drop existing customer/order/whitelist tables or run accept-data-loss. A later reinstall must reinstall triggers and reconcile changes made while disabled. No destructive rollback script is supplied.

## Verification and remaining acceptance work

Run from the repository root:

```sh
node --import tsx scripts/check-tikkies-entitlements.ts
node --import tsx scripts/check-tikkies-route.ts
node --import tsx scripts/check-tikkies-roblox.ts
node --import tsx scripts/check-tikkies-payments.ts
node --import tsx scripts/check-tikkies-fulfillment.ts
node --import tsx scripts/check-tikkies-backfill.ts
node --import tsx scripts/check-tikkies-points.ts
node --import tsx scripts/check-tikkies-admin.ts
node --import tsx scripts/check-tikkies-db.ts
```

The DB test creates an isolated schema in one transaction, runs migration twice, checks source revisions/binding invalidation/audit, and rolls back **all DDL/data**; it never migrates production tables. HTTP/payment/admin fixtures mock external dependencies; they do not capture/refund money or log in as customers. See the implementation plan's validation ledger for actual run results.

Still required before production enablement: staging migration against a representative backup and traffic, actual Google/Discord sessions supplied by Tikkies backend, real Roblox username/by-ID calls and reviewed legacy resolution, Stripe/PayPal sandbox signatures/deliveries/refund ordering/merchant configuration, customer/admin acceptance, and live monitoring. No production migration, customer backfill, real payment/refund, push or deployment was performed for this task.
