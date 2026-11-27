# Manual membership grants and payment verification

Goal: selecting A Class Games in admin whitelist grants all eligible current/future AC games and full Tikkies for the admin-selected term. Verify paid checkout fulfillment and deploy published Git source.

Architecture: reuse frozen bundle terms and atomic bundle fulfillment, without points, commissions or payment calls for admin grants. Preserve unregistered-email reservations (no phantom accounts); grant Roblox rights immediately, assign account-bound rights after verified Google/Discord claim without restarting the term. Keep membership marker rows manageable through whitelist, using bundle reversal before replacement/removal so unrelated access survives.

Constraints: no real payments or synthetic production grants; no schema/dependency changes; preserve unrelated local edits; keep membership navigation hidden. Deploy only exact published main after comparing dirty trees, current serving source and build identity; retain rollback artifacts.

- [x] Reproduce missing grants in disposable PostgreSQL-compatible database through actual whitelist POST.
- [x] Add manual bundle grant helper; route bundle grants through shared fulfillment. Support pending email Roblox grants and verified account claim of parent/children/desktop rights. Sync new games within original expiry.
- [x] Keep whitelist membership edit/delete consistent with game and Tikkies rights; show explanatory bundle copy and suppress unrelated game premium option.
- [x] Run real DB regression checks for existing/email recipients, expiry/permanent, future games, revocation, preservation and rollback. Verify paid fulfillment, Stripe/PayPal checks and replay behavior; lint/typecheck relevant code. Production build is the release preparation gate.
- [ ] Review implementation, publish exact release to Git, fetch on VPS, build separately with backups, activate and verify commit/build/access/health plus worker versions. Record rollback and remaining limitations.

Baseline: local HEAD, origin/main, VPS HEAD and clean serving source all bcd7d8ebe55034846bed21d2e6fcaa31f7bb0b2f. Serving build fhyzjgf9keW3kuxa4vcaZ. Isolated worktree excludes the original checkout's unfinished edits.

Review: independent code review found destination collision, removed-game restoration and reverse/regrant lock-order issues. Added collision checks, frozen snapshot/exclusion preservation and bounded retries for confirmed transaction aborts (also on the payment side). Reviewer rechecked and reported no remaining Important/Critical findings. Multi-connection lock contention itself remains outside PGlite's capabilities.
