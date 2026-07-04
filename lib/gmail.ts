// Read-only Gmail client for the PayPal.me verification worker.
// Auth is a long-lived refresh token (minted once via scripts/gmail-auth.ts);
// the OAuth2 client transparently swaps it for short-lived access tokens.
//
// Scope is gmail.readonly — the worker only ever READS the mailbox.
//
// We use the OAuth2 class bundled with @googleapis/gmail (via its `auth` export)
// so its type lines up exactly with gmail()'s expected auth — importing a
// separate google-auth-library copy causes a nominal type mismatch.

import { gmail, auth as googleAuth, type gmail_v1 } from "@googleapis/gmail"

export function getGmailClient(): gmail_v1.Gmail {
  const clientId = process.env.GMAIL_CLIENT_ID
  const clientSecret = process.env.GMAIL_CLIENT_SECRET
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Gmail credentials missing — set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN (run scripts/gmail-auth.ts)",
    )
  }

  const oauth2 = new googleAuth.OAuth2(clientId, clientSecret)
  oauth2.setCredentials({ refresh_token: refreshToken })
  return gmail({ version: "v1", auth: oauth2 })
}
