// Fetch public info for a Discord invite (server name + member counts) so we can
// show the real server name on the order page. No auth needed. Cached for 1h so
// we don't hit Discord on every page load. Returns null on any failure — callers
// fall back to a generic label.

export type DiscordInvite = { name: string; members: number; online: number }

export async function getStoreDiscordInvite(code: string): Promise<DiscordInvite | null> {
  try {
    const res = await fetch(
      `https://discord.com/api/v10/invites/${encodeURIComponent(code)}?with_counts=true`,
      { next: { revalidate: 3600 }, headers: { "User-Agent": "AClassStore/1.0" } },
    )
    if (!res.ok) return null
    const data = await res.json()
    if (!data?.guild?.name) return null
    return {
      name: String(data.guild.name),
      members: Number(data.approximate_member_count ?? 0),
      online: Number(data.approximate_presence_count ?? 0),
    }
  } catch {
    return null
  }
}
