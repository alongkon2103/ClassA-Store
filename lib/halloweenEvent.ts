export const HALLOWEEN_EVENT = {
  id: "halloween-2026",
  startsAt: "2026-10-30T00:01:00+07:00",
  endsAt: "2026-11-01T00:01:00+07:00",
} as const
export const HALLOWEEN_GAME_SLUGS = ["ac-universe", "ac-anime-runner1-1", "ac-jump-evo", "ac-pig-panic", "ac-slash"] as const
export type HalloweenGame = { id: string; slug: string; name_th: string; name_en: string; type: string; imageUrl: string | null }
export type HalloweenPrize = { kind: "points"; amount: number } | { kind: "game"; product: HalloweenGame; days: number }
export type HalloweenDraw = {
  id: string; prize: HalloweenPrize; claimedAt: string | null
  result: { expiresAt: string; ign: string | null; permanent: boolean } | null
  orderId: string | null
}
export type HalloweenState = {
  phase: "upcoming" | "active" | "ended"; signedIn: boolean; available: boolean
  startsAt: string; endsAt: string; serverNow: string; games: HalloweenGame[]; draw: HalloweenDraw | null
}

export function halloweenPhase(now: Date): HalloweenState["phase"] {
  return now < new Date(HALLOWEEN_EVENT.startsAt) ? "upcoming" : now >= new Date(HALLOWEEN_EVENT.endsAt) ? "ended" : "active"
}

// 900 of 1,500 tickets are points; each of the ten game/day combinations gets 60.
export function pickHalloweenPrize(games: HalloweenGame[], ticket: number): HalloweenPrize {
  if (!Number.isInteger(ticket) || ticket < 0 || ticket >= 1500 || games.length !== 5 || HALLOWEEN_GAME_SLUGS.some(slug => !games.some(game => game.slug === slug))) throw new Error("invalid_halloween_pool")
  if (ticket < 900) return { kind: "points", amount: [2000, 3000, 5000][Math.floor(ticket / 300)] }
  const index = Math.floor((ticket - 900) / 60)
  return { kind: "game", product: games.find(game => game.slug === HALLOWEEN_GAME_SLUGS[Math.floor(index / 2)])!, days: index % 2 === 0 ? 1 : 3 }
}
