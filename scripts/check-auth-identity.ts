// ตรวจการหา user เดิมตอนล็อกอิน — รัน: npx tsx scripts/check-auth-identity.ts
// บั๊ก 2026-09-19: provider ไม่ส่งอีเมลมา (Discord) → หา user จากอีเมลไม่เจอ → สร้าง user ใหม่ทุกครั้งที่ล็อกอิน ลูกค้าไม่เห็นออเดอร์/สิทธิ์ของตัวเอง
import assert from "node:assert/strict"
import { findAccountUserId, findExistingUserId, type IdentityDb } from "../lib/authIdentity"

const users = [{ id: "u-masa", email: "masa@example.com" }, { id: "u-other", email: "other@example.com" }]
const db: IdentityDb = {
  accounts: { findUnique: async ({ where }) => {
    const k = where.provider_provider_account_id
    return k.provider === "discord" && k.provider_account_id === "D1" ? { user_id: "u-masa" } : null
  } },
  users: { findFirst: async ({ where }) => users.find((u) => u.email === where.email) ?? null },
}
;(async () => {
  assert.equal(await findExistingUserId(db, "discord", "D1", null), "u-masa", "บัญชีที่ผูกไว้แล้ว + provider ไม่ส่งอีเมล → ต้องได้ user เดิม ไม่ใช่สร้างใหม่")
  assert.equal(await findExistingUserId(db, "discord", "D1", "other@example.com"), "u-masa", "บัญชีที่ผูกไว้ชนะอีเมล (อีเมลฝั่ง provider เปลี่ยนไปตรงกับคนอื่น)")
  assert.equal(await findExistingUserId(db, "google", "G9", "other@example.com"), "u-other", "provider ใหม่ + อีเมลเดิม → user เดิม")
  assert.equal(await findExistingUserId(db, "google", "G9", null), null, "ไม่เคยมี → null (สร้างใหม่)")
  assert.equal(await findExistingUserId(db, "dev-admin", "x", "nobody@example.com"), null)
  // session ของ user ที่ถูกรวมบัญชีไปแล้ว: หา user หลักจากบัญชี provider เดิม
  assert.equal(await findAccountUserId(db, "discord", "D1"), "u-masa")
  assert.equal(await findAccountUserId(db, "discord", "nope"), null)
  console.log("auth identity: OK")
})().catch((e) => { console.error(e.message); process.exit(1) })
