# Manual A Class Games membership verification

## Behavior

- Admin whitelist bundle grants use frozen terms and the shared atomic game fulfillment path. They carry zero amount, the recording administrator and no points/affiliate side effects.
- Selected days/permanent applies equally to all game children and full Tikkies. Current/future inclusion follows the server-side membership product flags. New games stop joining after expiry or revocation.
- Existing accounts receive rights immediately. Unregistered email grants do not create users: Roblox rights start immediately; verified Google/Discord claim assigns the parent/children and materializes desktop rights atomically, retaining the original expiry.
- Membership edits replace manual grants atomically using original frozen flags; deliberately removed game children remain excluded. Destination name collisions return 409. Removal reverses the membership's children without erasing independent rights.
- Only confirmed transaction-abort errors are retried, at most three times; ambiguous commit/time-out failures are not replayed. External payment/points/notification work stays outside retry callbacks.

## Executed verification

- `node scripts/run-membership-db-qa.cjs scripts/check-manual-membership-db.ts`: actual production handlers with disposable schema-only PGlite database. Initial regression failed with zero game children; final cases pass for existing/email recipients, exact/permanent expiry, desktop/Tikkies, future games before/after claim, edit/remove, forbidden callers, invalid inputs, replacement rollback, rename collisions, frozen terms and removed game exclusions.
- The same suite calls the actual Stripe webhook using SDK-generated synthetic signatures: no signature, unpaid or wrong amount cannot grant; paid matching event grants every game; duplicate delivery creates no duplicate children.
- Actual PayPal capture return handler against the disposable database with a synthetic provider response: wrong token/currency cannot grant; matching completed capture grants every game; repeat return does not capture again.
- `node scripts/run-membership-db-qa.cjs`: existing paid membership DB/HTTP suite passes, including Google/Discord linking, future sync, lifetime right preservation, payment retries, full Tikkies/library, refund/reversal and points idempotency.
- Targeted Stripe amount/session/currency checks, PayPal mail replay checks, checkout, customer identity, public membership and Tikkies membership/security checks pass. Transaction-abort retry tests cover Prisma and nested PostgreSQL errors, bounded retry and no replay on unknown failures.
- TypeScript and targeted ESLint pass. Deployment build is performed from the exact published Git commit before activation. Existing deployment rollback fault-injection tests pass.
- Read-only production audit found no existing membership orders requiring repair.

## Limits and release procedure

No real payments or synthetic production rights were created. PGlite has one backend and cannot exercise contested multi-connection PostgreSQL locks; bounded aborted-transaction retry is separately tested. It uses Prisma schema diff, not production custom triggers.

Before publishing, re-fetch origin and compare local, VPS checkout, serving source and dirty files. Publish only this isolated branch's changes. Use `scripts/deploy-verified-release.py prepare <published-commit> --baseline <serving-commit>` and then activate the prepared release. Preserve the previous build and checkout backup. Switch both PayPal and membership worker configurations to that same Git release, preserving their old PM2 configurations for rollback. Verify `/api/deployment-version`, release manifest, VPS Git HEAD, worker paths, health and unauthenticated access denials. The deployment helper records commit and rollback location in `.deploy/current.json` and the private backup manifest.
