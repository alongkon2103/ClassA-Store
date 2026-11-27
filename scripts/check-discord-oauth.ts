// Offline regression for Discord's RFC 9207 `iss` callback parameter.
// Run: npx tsx scripts/check-discord-oauth.ts
import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { TokenSet, type Client } from "openid-client"
import { authOptions } from "../lib/auth"

const requireFromHere = createRequire(__filename)
const nextAuthRoot = dirname(requireFromHere.resolve("next-auth"))
// Use the installed NextAuth provider normalization and OAuth client, so this
// exercises the application's actual provider options rather than a copy.
const parseProviders = requireFromHere(join(nextAuthRoot, "core/lib/providers.js")).default
const { openidClient } = requireFromHere(join(nextAuthRoot, "core/lib/oauth/client.js"))

const state = "offline-test-state"
const callback = { code: "offline-test-code", state, iss: "https://discord.com" }
const callbackUrl = "https://example.invalid/api/auth/callback/discord"

async function createClient(): Promise<Client> {
  const { provider } = parseProviders({
    providers: authOptions.providers,
    providerId: "discord",
    url: "https://example.invalid/api/auth",
  })
  assert.deepEqual(provider.checks, ["state"], "Discord must retain OAuth state checks")
  // Synthetic credentials; token exchange is the only external boundary and
  // is replaced below. No provider or database request is made by this test.
  const client: Client = await openidClient({
    provider: { ...provider, clientId: "offline-client", clientSecret: "offline-secret" },
  })
  client.grant = async () => new TokenSet({ access_token: "offline-access-token", token_type: "Bearer" })
  return client
}

async function main() {
  const client = await createClient()
  const tokens = await client.oauthCallback(callbackUrl, callback, { state })
  assert.equal(tokens.access_token, "offline-access-token", "Discord callbacks with the documented issuer must succeed")

  await assert.rejects(
    client.oauthCallback(callbackUrl, { ...callback, iss: "https://other.invalid" }, { state }),
    /iss mismatch/,
    "A callback from a different issuer must be rejected",
  )
  await assert.rejects(
    client.oauthCallback(callbackUrl, { ...callback, state: "wrong-state" }, { state }),
    /state mismatch/,
    "Adding the issuer must preserve state validation",
  )
  await assert.rejects(
    client.oauthCallback(callbackUrl, { code: callback.code, iss: callback.iss }, { state }),
    /state missing from the response/,
    "A callback with missing state must be rejected",
  )

  // Preserve compatibility with older Discord callbacks that lack `iss`.
  const legacyTokens = await client.oauthCallback(callbackUrl, { code: callback.code, state }, { state })
  assert.equal(legacyTokens.access_token, "offline-access-token")
  console.log("Discord OAuth: documented issuer accepted; wrong issuer, wrong/missing state rejected; legacy callback accepted (offline)")
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Discord OAuth regression failed")
  process.exitCode = 1
})
