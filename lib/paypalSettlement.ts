// PayPal cross-border settlement math. PayPal charges a percentage of the USD
// amount PLUS a fixed per-transaction fee, so the $0.39 has to be applied
// per-order — summing it from N orders is N × $0.39, not one flat $0.39.
//
// Admin requested this exact formula (replacing the prior flat 3.9% on THB
// which under-reported the fee and ignored the per-order fixed fee):
//   amount_thb = SUM(amount)
//   amount_usd = SUM(amount / 33.28)
//   net_usd    = SUM((amount / 33.28) * 0.956 - 0.39)
//   net_thb    = net_usd * 33.28

export const PAYPAL_THB_PER_USD = 33.28
export const PAYPAL_FEE_PCT = 4.4
export const PAYPAL_FIXED_FEE_USD = 0.39

function netUsdForOrder(amountThb: number): number {
  return (amountThb / PAYPAL_THB_PER_USD) * (1 - PAYPAL_FEE_PCT / 100) - PAYPAL_FIXED_FEE_USD
}

export type PaypalSettlement = {
  order_count: number
  amount_thb: number
  amount_usd: number
  net_usd: number
  net_thb: number
}

export function paypalSettlementFromAmounts(amountsThb: number[]): PaypalSettlement {
  const order_count = amountsThb.length
  const amount_thb = amountsThb.reduce((s, a) => s + a, 0)
  const amount_usd = amount_thb / PAYPAL_THB_PER_USD
  const net_usd = amountsThb.reduce((s, a) => s + netUsdForOrder(a), 0)
  const net_thb = net_usd * PAYPAL_THB_PER_USD
  return { order_count, amount_thb, amount_usd, net_usd, net_thb }
}
