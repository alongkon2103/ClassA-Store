# Discord announcements

Admin-only console: `/th/admin/discord-studio` (Marketing → Discord announcements).
It uses the site's actual colors, font faces, dark/light theme and form layout.
Staff write TH/EN/JP/CN/KR/VN text and attach different images for each language.
Members use a Discord dropdown to read privately. The same private response is
updated while its interaction token remains valid; long text has page controls.

The website checks `admin` on the page and every UI/API/media request, then signs
requests to the existing bot at loopback port 3710. Configure matching server-only
`DISCORD_STUDIO_BRIDGE_SECRET` in the website environment and `bridgeSecret` in
the bot's private console credentials. Never expose these in public variables.
The original SSH-only console remains available for recovery. No database changes.

## Deploy from Git

Before every deployment, fetch and compare local, remote, VPS and currently served
source. A matching HEAD is insufficient when a checkout has uncommitted edits or
`.next` serves a different release. Commit and push the intended source first.

On the VPS, run the helper from the fetched checkout:

```sh
./deploy.sh prepare <published-main-commit> --baseline <commit-recording-served-source>
# Verify the release on a private loopback port, then activate that exact path.
./deploy.sh activate /var/www/ClassA-Store-release-<commit>-<timestamp>
```

Prepare verifies the served source against its recorded baseline, clones published
main, checks out the exact commit and builds separately. It captures the VPS file
fingerprint and exact reviewed edits, and rejects dependency/schema changes that
need a different deployment procedure. If Google Fonts cannot be fetched, `prepare --font-cache <cache.cjs>`
can reuse the server's existing font build cache.

Activation holds an exclusive lock and rechecks remote main, the currently served
build and the captured VPS files. It backs up the VPS
checkout, fast-forwards its Git main and switches only the verified build. It
preserves old static assets for already-open browser pages and keeps the old build
for rollback. It never runs database schema commands, `reset` or `clean`.

If the existing VPS checkout contains edits, reconcile them first. For the initial
reconciliation, `--preserve-vps-edits` explicitly archives and stashes them before
the fast-forward; the stash stays local and is recorded in the backup manifest.
Do not automatically reapply that stash over the new release.

After deployment compare `git rev-parse HEAD`, `origin/main`,
`.next/release-info.json` and `.deploy/current.json`, then check website health,
`/api/deployment-version` (the SHA inlined into the responding build), admin-only
access, uploads and session recovery. Backup paths and the old build
are recorded in the manifest. Never delete the font cache's referenced files
until a subsequent build uses a replacement cache.

Proxy verification: `npx tsx scripts/check-discord-studio-proxy.ts`.
The bot repository contains its reader/bridge tests and private-room/browser QA.
