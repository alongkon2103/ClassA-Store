<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Deployment workflow

- Before every website deployment, fetch the remote and compare the local branch/commit, remote branch/commit, VPS checkout and the source of the build currently serving traffic. Check working-tree changes too; matching HEADs alone is insufficient.
- Commit and push the intended release to Git first. The VPS must fetch and check out that exact published commit before building/deploying; do not deploy website source through direct file copies or archives.
- Preserve and reconcile any newer deployed source that has not yet been versioned, and keep unrelated unfinished local edits separate. Back up the running build and VPS changes before switching releases; never discard them with a reset or clean.
- After deployment, verify the published Git commit, VPS checkout and running build manifest match, then run the relevant health/access/UI checks. Record the deployed commit and rollback location.
