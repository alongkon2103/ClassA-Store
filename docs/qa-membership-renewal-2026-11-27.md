# Membership renewal verification

Duplicate grants from admin whitelist now add days from the same recipient/player's valid membership expiry. If no unexpired membership exists, the term starts when saved. Actual payment/fulfillment timestamps stay truthful. A strict, server-generated `renewalBaseExpiresAt` in frozen terms records the previous expiry, and a shared calculation supplies the end date for all game children, desktop rights, future game synchronization and full Tikkies.

Membership parent expiry is bounded by its frozen terms before it can supply remaining time. Individual game aggregate expiries, another user/email's membership, corrupt terms and revoked/expired orders cannot supply additional time. Permanent membership stays permanent. Name-only edits preserve the accumulated term; explicit duration edits retain the existing set-from-now behavior. Paid checkout behavior is unchanged, and an admin may top up an existing paid membership.

## Verified

- `node scripts/run-membership-db-qa.cjs scripts/check-membership-renewal-db.ts`: initially failed because remaining days were lost; passes after the fix. Real POST/PATCH, schema-only disposable PGlite database, synthetic users/products only.
- Active and repeated renewal preserves the exact prior expiry (including partial days) plus new days. Roblox/desktop game orders, aggregates and Tikkies all use that exact end. Future games can join after the latest-added days would otherwise have ended, and access ends at the shared boundary.
- Expired memberships restart now; pending emails accumulate before claim and retain the same expiry when verified. Known accounts retain their still-unclaimed mailbox reservation. Admin top-up of a paid membership retains the paid term without revoking that purchase.
- Permanent rights do not become finite. Different recipients/emails cannot inherit each other's remaining time. Inflated mutable parent expiry is capped by frozen terms. Invalid/overflowing renewal bases fail closed. Name-only and explicit-duration editing behave as specified.
- `node scripts/run-membership-db-qa.cjs scripts/check-manual-membership-db.ts`: existing manual membership, authorization, email, rollback, collision, exclusions and actual Stripe/PayPal handler tests pass with synthetic provider data.
- `node scripts/run-membership-db-qa.cjs`: existing paid membership DB/HTTP suite passes (Google/Discord, retry, future games, refund/reversal, independent lifetime access and points idempotency).
- Targeted frozen membership, checkout, Stripe payment matching, PayPal replay and transaction retry scripts pass. TypeScript, targeted ESLint, `git diff --check`, and deployment rollback fault-injection tests pass. Independent review found no Critical/Important issue.

No real payments or production test grants were created. PGlite does not validate contested multi-connection PostgreSQL locking or install custom production triggers. Existing player/recipient locks and transaction-abort retry policy remain in place.

## Deployment

Fetch/compare Git, clean VPS checkout and the actual serving source before release. Publish the exact commit to Git, then build that commit on VPS with the verified release helper. Back up and stop old payment/membership workers before switching website builds so an old worker cannot interpret new terms. Start both workers from the same published release; verify source/manifest/responding commit, online worker paths, HTTP health/access and backend membership connection. Record deployment commit, previous build and rollback artifacts in the private deployment manifests. A rollback to an older parser does not understand newly created renewal bases, so such terms require renewal-aware code to retain their full accumulated expiry.
