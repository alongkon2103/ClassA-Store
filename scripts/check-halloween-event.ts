import assert from "node:assert/strict"
import * as event from "../lib/halloweenEvent"

const api = event
assert.equal(typeof api.halloweenPhase, "function", "The event must enforce server-side Bangkok boundaries")
assert.equal(api.halloweenPhase(new Date("2026-10-30T00:00:59+07:00")), "upcoming")
assert.equal(api.halloweenPhase(new Date("2026-10-30T00:01:00+07:00")), "active")
assert.equal(api.halloweenPhase(new Date("2026-11-01T00:00:59+07:00")), "active")
assert.equal(api.halloweenPhase(new Date("2026-11-01T00:01:00+07:00")), "ended")
const games = Array.from({ length: 5 }, (_, i) => ({ id: `game${i}`, slug: api.HALLOWEEN_GAME_SLUGS[i], name_th: `เกม ${i}`, name_en: `Game ${i}`, type: i === 4 ? "desktop_program" : "roblox_whitelist", imageUrl: `/uploads/game${i}.webp` }))
const counts = new Map<string, number>()
for (let ticket = 0; ticket < 1500; ticket++) {
  const prize = api.pickHalloweenPrize(games, ticket)
  const key = prize.kind === "points" ? `points:${prize.amount}` : `${prize.product.id}:${prize.days}`
  counts.set(key, (counts.get(key) ?? 0) + 1)
}
assert.equal(counts.size, 13)
for (const amount of [2000, 3000, 5000]) assert.equal(counts.get(`points:${amount}`), 300)
for (const game of games) for (const days of [1, 3]) assert.equal(counts.get(`${game.id}:${days}`), 60)
assert.throws(() => api.pickHalloweenPrize(games, -1))
assert.throws(() => api.pickHalloweenPrize(games, 1500))
assert.throws(() => api.pickHalloweenPrize(games.slice(1), 0), "Never silently change odds if a game is missing")
console.log("Halloween event: Bangkok boundaries, 13 prizes, exact 60/40 distribution and invalid ticket/catalog rejection OK")
