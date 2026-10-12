// Presentation only: keep stored THB prices intact so checkout doesn't add the fee twice.
export function productDisplayPrice(thb: number, locale: string, usdRate: number, feePct = 6): number {
  if (locale === "th") return thb
  return Math.round(thb * (1 + feePct / 100) * usdRate * 100) / 100
}
