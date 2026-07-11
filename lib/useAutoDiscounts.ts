"use client"

// Shared hook powering the personalised strikethrough price on shop + home
// product cards. Fetches every applicable public auto-select code ONCE per page
// (re-fetching when the signed-in user changes, so "already used" stays
// accurate), then exposes a pure per-variant best-deal lookup.
//
// Call this ONCE in a card container and pass `bestDiscountedPrice` down to the
// cards — never once per card, or you'd fire one request per tile.

import { useCallback, useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { pickBestAutoCode, type AutoCodeCandidate } from "@/lib/discountCodes"

type AutoPreviewCode = {
  code: string
  type: string
  value: number
  min_amount: number | null
  product_id: string | null
  sold_out: boolean
  already_used: boolean
}

export function useAutoDiscounts() {
  const { data: session } = useSession()
  const [codes, setCodes] = useState<AutoPreviewCode[] | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch("/api/discount-codes/auto-preview")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setCodes(Array.isArray(d?.codes) ? d.codes : [])
      })
      .catch(() => {
        if (!cancelled) setCodes([])
      })
    return () => {
      cancelled = true
    }
    // Re-fetch on login/logout so already_used reflects the current shopper.
  }, [session?.user?.id])

  // Best discounted price for one variant, or null if no auto code applies to
  // this shopper for this price (below min / sold out / already used / none).
  const bestDiscountedPrice = useCallback(
    (productId: string, price: number): number | null => {
      if (!codes || codes.length === 0) return null
      const candidates: AutoCodeCandidate[] = codes
        .filter((c) => c.product_id === null || c.product_id === productId)
        .map((c) => ({
          code: c.code,
          type: c.type,
          value: c.value,
          minAmount: c.min_amount,
          isAutoSelect: true,
          soldOut: c.sold_out,
          alreadyUsed: c.already_used,
        }))
      const best = pickBestAutoCode(candidates, price)
      if (!best) return null
      const discounted = Math.round((price - best.amountOff) * 100) / 100
      return discounted < price ? discounted : null
    },
    [codes],
  )

  return { bestDiscountedPrice }
}
