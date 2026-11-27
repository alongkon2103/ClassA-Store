# Store membership renewal QA

Successful repeat purchases add the purchased period to the same product/account/player's valid frozen membership expiry. New/expired membership starts at fulfillment. A shared helper supplies both admin and customer renewal terms, preserving real fulfillment timestamps and the exact common end for Roblox/desktop game orders, future games and full Tikkies. Permanent rights remain permanent.

The payment parent is locked and checked for paid/terminal state first. Customer purchases then serialize on the same product/player advisory key as admin grants. The new frozen renewal snapshot, game children and paid parent commit together under READ COMMITTED. Prior purchases remain independently reversible; duplicate delivery returns before extending time, counting discounts, earning commission or creating game children. Points retain their existing idempotent order ledger.

## Verification

- `check-paid-membership-renewal-db.ts` against disposable PGlite: initial signed Stripe test failed because ten remaining days were lost; passes with the change. Real production HTTP handlers use synthetic SDK-signed Stripe events and synthetic PayPal capture responses. Missing signature, incorrect amount/currency/token and unpaid events grant nothing. Paid Stripe→PayPal→PayPal.me periods stack; callbacks/returns do not duplicate time, games, captures or points.
- Exact game/desktop/Tikkies expiry, future game grants after the latest purchased period alone would have ended, and expiry boundary denial pass. Expired membership restarts now; other customers/players/products do not inherit time. Admin/store cross-renewal and lifetime preservation pass.
- Reversing the newly purchased extension preserves the earlier valid period; refunded parents do not supply time to the next purchase. Injected child-write failure rolls back the new term and all children; retry and queued purchases retain both periods.
- `check-paid-renewal-concurrency.ts` passed on real PostgreSQL16, pool6, temporary role/database at 127.0.0.1:55439. An independent blocker and monitor verified actual advisory-lock waiters before releasing concurrent purchases, duplicate callbacks and mixed admin/payment grants. Both purchased periods survive, duplicates grant only once, and mixed operations retain all added days. Source came from published feature commit39c345be68f4e5abce911e9de038cb5f6e0ec8b8. No production environment or data was used; the temporary cluster/checkout was stopped and removed.
- Existing admin-renewal, manual membership/Stripe/PayPal, paid membership DB/HTTP, identity/linking, future game, refund, lifetime and points suites pass. TypeScript, targeted ESLint and diff checks pass; independent review reports no introduced Critical/Important issue.

No real charges or synthetic production grants were created. Schema-only test databases do not install custom production triggers. Existing frozen-term reversal policy remains unchanged. The PostgreSQL test must use the serving release's runtime: the main checkout's older generated Prisma client lacks bundle fields; deployment already links the current serving release runtime.

## Release gates

Publish to Git, re-compare origin/local/VPS/actual serving source and dirty trees, build exact published main on VPS, preserve previous build/checkout/worker definitions. Stop old payment and membership workers before website activation and restart them from the same release. Verify manifest/responding Git commit, source cleanliness, HTTP/access, membership backend link, FAQ and worker health, and store rollback metadata in the private deployment manifests.
