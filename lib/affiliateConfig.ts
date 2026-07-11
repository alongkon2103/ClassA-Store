// Affiliate program settings stored in system_configs (admin-editable, no
// redeploy). Currently just the minimum self-service withdrawal amount.

import { prisma } from "@/lib/prisma"

export const AFFILIATE_MIN_WITHDRAW_KEY = "affiliate_min_withdraw"
export const DEFAULT_MIN_WITHDRAW = 100

export async function getAffiliateMinWithdraw(): Promise<number> {
  const row = await prisma.system_configs.findUnique({ where: { key: AFFILIATE_MIN_WITHDRAW_KEY } })
  const n = row?.value ? Number(row.value) : NaN
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_MIN_WITHDRAW
}

export async function setAffiliateMinWithdraw(value: number): Promise<void> {
  await prisma.system_configs.upsert({
    where: { key: AFFILIATE_MIN_WITHDRAW_KEY },
    create: { key: AFFILIATE_MIN_WITHDRAW_KEY, value: String(value) },
    update: { value: String(value) },
  })
}
