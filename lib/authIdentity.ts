// หา user เดิมตอนล็อกอิน / ตอนต่ออายุ session — แยกออกมาให้ทดสอบได้ (scripts/check-auth-identity.ts)
// บั๊ก 2026-09-19: เดิมหา user จาก "อีเมลอย่างเดียว" → provider ไม่ส่งอีเมลมา (Discord ทำได้) = สร้าง user ใหม่ทุกครั้งที่ล็อกอิน
// ลูกค้าเลยไม่เห็นออเดอร์/สิทธิ์ของตัวเอง ทั้งที่บัญชี provider ผูกกับ user เดิมอยู่แล้วในตาราง accounts
// db = prisma (หรือของปลอมในเทสต์)

export type IdentityDb = {
  accounts: {
    findUnique(args: { where: { provider_provider_account_id: { provider: string; provider_account_id: string } }; select: { user_id: true } }): PromiseLike<{ user_id: string } | null>
  }
  users: { findFirst(args: { where: { email: string }; select: { id: true } }): PromiseLike<{ id: string } | null> }
}

/** user ที่ผูกกับบัญชี provider นี้ไว้แล้ว (ตาราง accounts) */
export async function findAccountUserId(db: IdentityDb, provider: string, providerAccountId: string): Promise<string | null> {
  const acc = await db.accounts.findUnique({
    where: { provider_provider_account_id: { provider, provider_account_id: providerAccountId } },
    select: { user_id: true },
  })
  return acc?.user_id ?? null
}

/** user เดิมของคนที่กำลังล็อกอิน (null = ยังไม่เคยมี ต้องสร้างใหม่) */
export async function findExistingUserId(db: IdentityDb, provider: string, providerAccountId: string, email: string | null): Promise<string | null> {
  // 1) บัญชี provider ที่เคยผูกไว้ → user เดิมเสมอ แม้ provider ไม่ส่งอีเมลมา หรืออีเมลฝั่ง provider เปลี่ยนไปแล้ว
  const linked = await findAccountUserId(db, provider, providerAccountId)
  if (linked) return linked
  // 2) ครั้งแรกของ provider นี้ แต่อีเมลตรงกับ user เดิม (เช่น เคยใช้ Google แล้วมาใช้ Discord)
  if (!email) return null
  return (await db.users.findFirst({ where: { email }, select: { id: true } }))?.id ?? null
}
