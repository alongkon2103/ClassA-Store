# Website announcement implementation plan

Goal: replace automatic daily reward prompts with scheduled, admin-authored website announcements while preserving manual AC Points claims.

Scope and decisions: a separate Admin → Website announcements screen; title, rich text, cover and inline images, enabled/draft switch, start and optional end date/time in Asia/Bangkok. All storefront visitors can see active announcements. Closing remembers the announcement revision in that browser; saving a revision makes it eligible again. Admin, checkout and the image editor are excluded. Desktop announcements and Discord publishing are separate.

Storage: one JSON document per `web_announcement:<uuid>` key in the existing `system_configs` table. Independent rows avoid overwriting other announcements or configuration during CRUD and need no schema migration. Only admin routes may mutate; the public endpoint returns currently active content and the next schedule boundary. HTML is allowlisted with the already installed parse5 parser, declared directly for reliability.

## 1. Daily rewards

- Remove the automatic-fetch/open effect and automatic-dismiss tracking from DailyLoginPopup.
- Preserve the navbar's explicit-open event, claim handlers, daily API and Coins page controls.
- Check that no points configuration or earning logic changes.

## 2. Admin authoring and safe storage

- Add assert checks for schedule boundaries, invalid dates/ranges, URL/HTML filtering, malformed payloads and Bangkok conversion; observe failures before implementation.
- Implement pure announcement validation/scheduling helpers and a separate Prisma storage module.
- Add admin-only CRUD routes, a guarded admin page and navigation entry.
- Reuse TiptapEditor with optional direct inline-image upload. Add cover upload/removal, precise schedule inputs, draft/publication state, status badges, errors and preview using the public dialog.
- Preserve formatting, safe image/link URLs, tables and YouTube embeds; strip scripts, handlers and unsafe styles/URLs before public rendering.

## 3. Storefront modal and verification

- Add uncached public GET with active items and the nearest future schedule transition; never expose draft or future content.
- Mount the popup in the locale layout. Refresh on transitions, navigation and focus; close expired items, remember dismissals and handle unavailable storage/network.
- Use a native modal dialog for focus containment, Escape, backdrop closing and restoration; responsive scrolling and theme tokens.
- Add interface translations for en/th/ja/zh.
- Run helper checks, existing check scripts, affected lint and TypeScript; exercise authoring/preview and public popup in both themes and mobile. Report DB or browser limits separately from passed checks.

Review focus: invalid or equal schedule endpoints; users staying past expiry; dismissal surviving navigation but respecting revisions; hostile rich HTML; auth before DB mutations; manual points still reachable; upload failures preserving form edits.

## Verification results

Implemented all three sections. Helper checks cover schedule boundaries, calendar validation, Bangkok seconds and HTML/URL filtering. React DOM checks confirm manual daily claiming and announcement dismissal/revisions/expiry/exclusions. Browser checks cover authoring, invalid ranges, actual preview, Escape/focus restoration, light/dark and mobile without horizontal overflow. A temporary local database draft passed create/read/update/revision/delete and was removed. Unauthenticated admin GET returns 403; public GET returns 200 with no announcements. Affected lint has zero errors. Regenerating route types with the documented next typegen command removed a stale generated route reference; final TypeScript check passes. No schema migration or deployment.

Code review identified two corrected edge cases: preserve the safe Tiptap YouTube wrapper so reopened edits retain videos, and reject sanitized content exceeding the same storage read limit. Regression assertions pass; actual Tiptap sanitize/reopen/edit/re-save roundtrip also passes. All five existing check scripts and the new announcement helper script pass; affected lint remains zero errors. Unauthenticated POST/PATCH/DELETE also return 403.
