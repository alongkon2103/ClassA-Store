# Admin membership renewal

Goal: duplicate admin membership grants add the selected days to the same recipient/player's valid expiry; expired/new grants start now. All membership game orders, future-game grants and full Tikkies share the exact resulting expiry.

Approach: freeze a server-generated renewal base in bundle terms, preserve real fulfillment timestamps, and share expiry calculation across fulfillment, future sync and Tikkies. Consider only valid frozen paid parent orders for the same product, recipient and IGN; never inherit another recipient's remaining time or an inflated aggregate expiry. Permanent rights remain permanent. Explicit duration edits keep their existing set-from-now semantics; name-only edits preserve the renewed term. Paid checkout remains compatible and is regression-tested.

- [x] Reproduce lost remaining days through real whitelist POST against disposable PGlite.
- [x] Implement strict optional frozen renewal base, shared expiry calculation and admin renewal selection under existing recipient/player locks.
- [x] Test repeated renewals, expired grants, exact game/Tikkies/future-game expiry, pending email claims, ownership separation, lifetime preservation, frozen-term caps and editing behavior. Run existing manual/payment regression suites, TypeScript, lint and independent code review.
- [ ] Publish Git commit, re-compare origin/VPS/serving source and dirty trees, build exact commit on VPS, back up and activate. Move payment/membership workers to the same published release; verify versions, health and access and record rollback.

Baseline: clean isolated checkout, origin/main, VPS checkout and clean served source all ecd350e09627bd65801402fc883acf1e3f8da163; build HmXVUAyW1FmcNlnK0ijB9. No dependency/schema changes or real test payments/grants.

Independent review: no Critical/Important findings. Both optional coverage suggestions (registered account inheriting its unclaimed reservation, and paid membership top-up) are included and pass. Stop and preserve the old membership/payment worker configurations before activating the new website, then start both workers from the same release: old workers do not interpret the new frozen renewal base.
