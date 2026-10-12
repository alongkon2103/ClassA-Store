import assert from "node:assert/strict"
import { parseRewardInput, rewardImages } from "../lib/pointsRedeem"

const base = { kind: "external_code", title_th: "รางวัล", cost: 100, config: {} }
const images = ["/uploads/cover.webp", "https://example.com/details.png"]
const parsed = parseRewardInput({ ...base, image_urls: images })
assert.ok("data" in parsed)
assert.equal(parsed.data.image_url, images[0], "The first gallery image becomes the existing card cover")
assert.deepEqual((parsed.data.config as Record<string, unknown>).image_urls, images, "Every image survives saving")
for (const invalid of ["/uploads/a.webp", [null], ["javascript:alert(1)"], ["//evil.test/a.png"], ["https://"], ["/uploads/\\evil"], Array(21).fill(images[0])]) {
  assert.deepEqual(parseRewardInput({ ...base, image_urls: invalid }), { error: "invalid_images" })
}
const legacy = parseRewardInput({ ...base, image_url: images[0] })
assert.ok("data" in legacy)
assert.equal(legacy.data.image_url, images[0], "Existing single-image payloads remain supported")
const empty = parseRewardInput({ ...base, image_urls: [], image_url: images[0] })
assert.ok("data" in empty)
assert.equal(empty.data.image_url, null, "Removing every image clears the old cover")
assert.deepEqual(rewardImages({ image_url: images[0], config: {} }), [images[0]], "Old rewards display their single cover in details")
assert.deepEqual(rewardImages({ image_url: images[0], config: { image_urls: images } }), images)
assert.deepEqual(rewardImages({ image_url: null, config: { image_urls: [null, "", images[1]] } }), [images[1]])
for (const [kind, config] of [
  ["external_code", {}],
  ["game_days", { product_id: "11111111-1111-1111-1111-111111111111", days: 3 }],
  ["discount_code", { type: "percent", value: 10, product_id: null, valid_days: 30 }],
] as const) {
  const result = parseRewardInput({ ...base, kind, config, image_urls: images, description_th: "บรรทัดแรก\nบรรทัดสอง" })
  assert.ok("data" in result)
  assert.deepEqual(result.data.config, { ...config, image_urls: images }, "Gallery storage preserves each reward's redemption configuration")
  assert.equal(result.data.description_th, "บรรทัดแรก\nบรรทัดสอง")
}
console.log("Reward galleries: cover, persistence, legacy input, removal and validation OK")
