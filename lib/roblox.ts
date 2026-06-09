/**
 * Roblox public-API helpers.
 *
 * Two unauthenticated endpoints:
 *   1. users.roblox.com/v1/usernames/users → username → userId + displayName
 *   2. thumbnails.roblox.com/v1/users/avatar-headshot → userId → avatar URL
 *
 * Browsers can't hit these directly (no CORS), so we wrap them in a Route
 * Handler at /api/roblox/verify and call that from the client.
 */
const USERS_API  = "https://users.roblox.com/v1/usernames/users"
const AVATAR_API = "https://thumbnails.roblox.com/v1/users/avatar-headshot"

export type RobloxUser = {
  id:          number
  username:    string
  displayName: string
  avatarUrl:   string | null
}

export type LookupResult =
  | { ok: true;  user: RobloxUser }
  | { ok: false; reason: "not_found" | "network" | "invalid" }

const USERNAME_RE = /^(?!.*__)(?!_)(?!.*_$)[A-Za-z0-9_]{3,20}$/

export function isPlausibleUsername(s: string): boolean {
  return USERNAME_RE.test(s.trim())
}

export async function lookupRobloxUser(rawUsername: string): Promise<LookupResult> {
  const username = rawUsername.trim()
  if (!isPlausibleUsername(username)) return { ok: false, reason: "invalid" }

  let userId:             number
  let canonicalUsername:  string
  let displayName:        string
  try {
    const res = await fetch(USERS_API, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ usernames: [username], excludeBannedUsers: false }),
      signal:  AbortSignal.timeout(6_000),
    })
    if (!res.ok) return { ok: false, reason: "network" }
    const json = (await res.json()) as { data?: Array<{ id: number; name: string; displayName: string }> }
    const hit  = json.data?.[0]
    if (!hit) return { ok: false, reason: "not_found" }
    userId            = hit.id
    canonicalUsername = hit.name
    displayName       = hit.displayName ?? hit.name
  } catch {
    return { ok: false, reason: "network" }
  }

  let avatarUrl: string | null = null
  try {
    const url = `${AVATAR_API}?userIds=${userId}&size=150x150&format=Png`
    const res = await fetch(url, { signal: AbortSignal.timeout(4_000) })
    if (res.ok) {
      const json = (await res.json()) as { data?: Array<{ imageUrl?: string; state?: string }> }
      const hit  = json.data?.[0]
      if (hit?.state === "Completed" && hit.imageUrl) avatarUrl = hit.imageUrl
    }
  } catch {
    // avatar is optional
  }

  return {
    ok:   true,
    user: { id: userId, username: canonicalUsername, displayName, avatarUrl },
  }
}
