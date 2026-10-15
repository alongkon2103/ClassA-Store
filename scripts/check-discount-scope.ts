// ตรวจขอบเขตโค้ดส่วนลด (ทางเงิน): all = ทุกเกม · ours = เฉพาะเกม A Class · partner = เฉพาะเกม Maki · ผูกเกมเดียว = เฉพาะเกมนั้น
// รัน: npx tsx scripts/check-discount-scope.ts
import assert from "node:assert/strict"
import type { discount_codes } from "@prisma/client"
import { codeAppliesTo, evaluateDiscount, parseDiscountProductIds } from "../lib/discountCodes"

const base = {
  id: "c", code: "X", type: "fixed", value: 50, max_uses: null, used_count: 0, per_user_limit: null, min_amount: null,
  product_ids: [] as string[], product_id: null as string | null, partner_product_id: null as string | null, starts_at: null, expires_at: null, is_active: true, is_public: true,
  is_auto_select: false, owner_user_id: null as string | null, commission_pct: null, note: null, created_at: null, updated_at: null, game_scope: "all",
}
const mk = (o: Partial<typeof base>) => ({ ...base, ...o }) as unknown as discount_codes
const OUR = "11111111-1111-1111-1111-111111111111", MAKI = "22222222-2222-2222-2222-222222222222"
const ours = (c: discount_codes) => evaluateDiscount(c, 500, OUR, 0).ok
const maki = (c: discount_codes) => evaluateDiscount(c, 500, MAKI, 0, new Date(), { partner: true }).ok

assert.deepEqual([ours(mk({})), maki(mk({}))], [true, true], "all = ทุกเกม")
assert.deepEqual([ours(mk({ game_scope: "ours" })), maki(mk({ game_scope: "ours" }))], [true, false], "ours = เฉพาะเกม A Class")
assert.deepEqual([ours(mk({ game_scope: "partner" })), maki(mk({ game_scope: "partner" }))], [false, true], "partner = เฉพาะเกม Maki")
assert.deepEqual([ours(mk({ product_id: OUR })), maki(mk({ product_id: OUR }))], [true, false], "ผูกเกมเรา")
assert.deepEqual([ours(mk({ partner_product_id: MAKI })), maki(mk({ partner_product_id: MAKI }))], [false, true], "ผูกเกม Maki")
const r = evaluateDiscount(mk({ game_scope: "ours" }), 500, MAKI, 0, new Date(), { partner: true })
assert.equal(r.ok === false && r.errorCode, "WRONG_PRODUCT")

const g = (game_scope?: string) => ({ product_id: null, partner_product_id: null, ...(game_scope ? { game_scope } : {}) })
assert.deepEqual([codeAppliesTo(g("ours"), OUR, false), codeAppliesTo(g("ours"), MAKI, true)], [true, false])
assert.deepEqual([codeAppliesTo(g("partner"), OUR, false), codeAppliesTo(g("partner"), MAKI, true)], [false, true])
assert.deepEqual([codeAppliesTo(g(), OUR), codeAppliesTo(g("all"), MAKI, true)], [true, true], "ไม่มี game_scope (โค้ดเก่า) = all")
assert.equal(codeAppliesTo({ product_id: OUR, partner_product_id: null, game_scope: "all" }, OUR), true)
const SECOND = "33333333-3333-3333-3333-333333333333"
const EXCLUDED = "44444444-4444-4444-4444-444444444444"
const selected = mk({ product_ids: [OUR, SECOND], owner_user_id: "affiliate" })
for (const id of [OUR, SECOND]) {
  assert.equal(evaluateDiscount(selected, 500, id, 0).ok, true, "Every selected game can redeem")
  assert.equal(codeAppliesTo(selected, id), true, "Preview/referral uses the same allowlist")
}
assert.equal(evaluateDiscount(selected, 500, EXCLUDED, 0).ok, false, "Unselected games cannot redeem")
assert.equal(codeAppliesTo(selected, EXCLUDED), false, "Unselected games get no referral preview")
assert.equal(codeAppliesTo(selected, OUR, true), false, "Our-game allowlist never applies to partner games")
assert.equal(evaluateDiscount(selected, 500, OUR, 0, new Date(), { partner: true }).ok, false)
assert.equal(codeAppliesTo({ product_id: OUR }, OUR, true), false, "Legacy own-game scope does not match a partner ID")
console.log("discount scope: legacy, multiple games, exclusions and partner isolation OK")

assert.deepEqual(parseDiscountProductIds(null), [])
assert.deepEqual(parseDiscountProductIds([OUR, SECOND, OUR]), [OUR, SECOND])
for (const invalid of [[], "all", ["not-a-uuid"], [OUR, null], new Array(501).fill(OUR)]) {
  assert.throws(() => parseDiscountProductIds(invalid), /Select at least one valid game/)
}
console.log("discount selection validation: invalid/empty lists rejected, duplicates normalized OK")
