// Affiliate program settings stored in system_configs (admin-editable, no
// redeploy):
//   - minimum self-service withdrawal amount
//   - onboarding maturity: days an affiliate must wait AFTER their first-ever
//     sale before they can withdraw (a one-time gate — once passed it never
//     applies again). Set to 0 to disable.

import { prisma } from "@/lib/prisma"

export const AFFILIATE_MIN_WITHDRAW_KEY = "affiliate_min_withdraw"
export const DEFAULT_MIN_WITHDRAW = 100

export const AFFILIATE_WITHDRAW_WAIT_DAYS_KEY = "affiliate_withdraw_wait_days"
export const DEFAULT_WITHDRAW_WAIT_DAYS = 3
export const DAY_MS = 24 * 60 * 60 * 1000

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

export async function getAffiliateWithdrawWaitDays(): Promise<number> {
  const row = await prisma.system_configs.findUnique({ where: { key: AFFILIATE_WITHDRAW_WAIT_DAYS_KEY } })
  const n = row?.value ? Number(row.value) : NaN
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : DEFAULT_WITHDRAW_WAIT_DAYS
}

export async function setAffiliateWithdrawWaitDays(value: number): Promise<void> {
  await prisma.system_configs.upsert({
    where: { key: AFFILIATE_WITHDRAW_WAIT_DAYS_KEY },
    create: { key: AFFILIATE_WITHDRAW_WAIT_DAYS_KEY, value: String(value) },
    update: { value: String(value) },
  })
}

/**
 * When (epoch ms) an affiliate becomes eligible to withdraw, given the instant
 * of their first-ever earning. Returns null if the gate doesn't apply (no sale
 * yet, or wait disabled). This is a ONE-TIME gate: anchor on the first sale, so
 * once matured it stays matured regardless of later withdrawals.
 */
export function withdrawAvailableAt(firstEarningAt: Date | null, waitDays: number): number | null {
  if (!firstEarningAt || waitDays <= 0) return null
  return firstEarningAt.getTime() + waitDays * DAY_MS
}
