import { isPlausibleUsername } from "@/lib/roblox"
export type RobloxIdentity = { userId: string; username: string; displayName: string }
export type RobloxBinding = { roblox_user_id: string | null; roblox_username: string | null; roblox_display_name: string | null; roblox_resolved_for: string | null }
const empty: RobloxBinding = { roblox_user_id: null, roblox_username: null, roblox_display_name: null, roblox_resolved_for: null }
function parseIdentity(input: unknown): RobloxIdentity | null {
  if (!input || typeof input !== "object") return null
  const row = input as Record<string, unknown>
  if (typeof row.id === "number" && !Number.isSafeInteger(row.id)) return null
  const id = typeof row.id === "number" || typeof row.id === "string" ? String(row.id) : ""
  if (!/^[1-9][0-9]{0,31}$/.test(id) || typeof row.name !== "string" || !isPlausibleUsername(row.name) || typeof row.displayName !== "string" || row.displayName.length > 100) return null
  return { userId: id, username: row.name, displayName: row.displayName }
}
export async function lookupTikkiesRoblox(value: string, byId = false): Promise<RobloxIdentity | null> {
  if (byId ? !/^[1-9][0-9]{0,31}$/.test(value) : !isPlausibleUsername(value)) return null
  const response = await fetch(byId ? `https://users.roblox.com/v1/users/${value}` : "https://users.roblox.com/v1/usernames/users", {
    method: byId ? "GET" : "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
    ...(!byId ? { body: JSON.stringify({ usernames: [value.trim()], excludeBannedUsers: false }) } : {}), signal: AbortSignal.timeout(3000),
  })
  if (response.status === 429) {
    const seconds = Math.min(60, Math.max(1, Number(response.headers.get("retry-after")) || 5))
    throw new Error(`roblox_rate_limited:${seconds}`)
  }
  if (response.status === 404) return null
  if (!response.ok) throw new Error("roblox_unavailable")
  const data = await response.json()
  const identity = parseIdentity(byId ? data : data?.data?.[0])
  if (byId && identity?.userId !== value) return null
  return identity
}
// The official response identifies the requested name even when the account has been renamed.
export async function lookupTikkiesRobloxBatch(names: string[]): Promise<Map<string, RobloxIdentity>> {
  if (!names.length || names.length > 50 || names.some(name => !isPlausibleUsername(name))) throw new Error('invalid_roblox_names')
  const requested = new Set(names.map(name => name.trim().toLowerCase()))
  const response = await fetch('https://users.roblox.com/v1/usernames/users', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store', redirect: 'error',
    body: JSON.stringify({ usernames: [...requested], excludeBannedUsers: false }), signal: AbortSignal.timeout(3000),
  })
  if (!response.ok) throw new Error('roblox_unavailable')
  const body = await response.json(), identities = new Map<string, RobloxIdentity>()
  if (!Array.isArray(body?.data) || body.data.length > 50) throw new Error('roblox_response_invalid')
  for (const row of body.data) {
    const name = typeof row?.requestedUsername === 'string' ? row.requestedUsername.trim().toLowerCase() : ''
    const identity = parseIdentity(row)
    if (!requested.has(name) || !identity) continue
    if (identities.has(name) && identities.get(name)!.userId !== identity.userId) throw new Error('roblox_response_invalid')
    identities.set(name, identity)
  }
  return identities
}

export async function resolveTikkiesBinding(ign: string | null, existing?: Partial<RobloxBinding>): Promise<Partial<RobloxBinding>> {
  const normalized = ign?.trim().toLowerCase() ?? ""
  if (existing?.roblox_user_id && existing.roblox_resolved_for === normalized) return {}
  try {
    const identity = ign ? await lookupTikkiesRoblox(ign) : null
    return identity ? { roblox_user_id: identity.userId, roblox_username: identity.username, roblox_display_name: identity.displayName, roblox_resolved_for: normalized } : { ...empty }
  } catch {
    // A Roblox outage must never break payment fulfillment; integration stays locked until backfill succeeds.
    return { ...empty }
  }
}
