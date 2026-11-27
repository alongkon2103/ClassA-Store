# Store membership renewal

Goal: a successful repeat purchase adds the purchased days to the same product/account/player's current valid membership expiry; expired/new membership starts at payment fulfillment. Game children, future games and full Tikkies share the exact end.

Approach: extract the existing frozen admin renewal calculation into a shared helper; freeze the paid renewal base inside the atomic fulfillment transaction after a shared product/player advisory lock. The already-paid/terminal parent guard runs before any renewal or monetary effects. Both admin and store use the same source filters and immutable expiry caps. Preserve prior purchases and independent/lifetime rights, truthful fulfillment timestamps and existing points/commission behavior.

- [x] Reproduce the missing store renewal through a signed synthetic Stripe webhook and disposable schema-only database.
- [x] Reuse frozen renewal calculation, serialize paid/admin grants, atomically save renewal terms with parent/children; update membership FAQ.
- [x] Test Stripe/PayPal confirmation, duplicate events/returns, multi-purchase accumulation, expired/invalid/unpaid/wrong owner/player/product cases, permanent access, manual/paid cross-renewal, rollback/retry, and exact future-game/Tikkies expiry. Run prior regression suites, TypeScript, lint and independent review.
- [ ] Publish through Git; re-check remote/VPS/actual serving source and dirty trees, build exact commit on VPS, preserve old build/config, stop old workers before activation and restart from the same release. Verify commit/build/source/HTTP/access/backend link/worker health and record rollback.

Baseline: clean local checkout, origin/main, clean VPS checkout and clean served release all 788b62106bc7668bc2e1185f37485d7cfa340550; build r3nqqCV_lqkS8Foz3J_4A. No schema/dependency changes or real test charges/production grants.

Review found no introduced Critical/Important issue. Multi-session PostgreSQL16 tests passed from published feature commit39c345be68f4e5abce911e9de038cb5f6e0ec8b8 against an isolated unprivileged localhost:55439 cluster using the actual serving release runtime. Both simultaneous purchases, duplicate callbacks and mixed admin/payment grants were forced to contend on the production advisory lock, then verified. Temporary server and checkout were removed. Existing frozen-term refund policy remains unchanged.
