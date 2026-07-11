"use client"

// Shared hook powering the personalised strikethrough price on shop + home
// product cards. Fetches every applicable public auto-select code ONCE per page
// (re-fetching when the signed-in user changes, so "already used" stays
// accurate), then exposes a pure per-variant best-deal lookup.
//
// PRIORITY: if the shopper arrived via an affiliate link (/r/<code>, remembered
// in sessionStorage for this browsing session only), that affiliate's code wins
// the card preview over the global auto-select code — matching the modal.
//
// Call this ONCE in a card container and pass `bestDiscountedPrice` down to the
// cards — never once per card, or you'd fire one request per tile.

import { useCallback, useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { pickBestAutoCode, previewDiscountAmount, type AutoCodeCandidate } from "@/lib/discountCodes"

type AutoPreviewCode = {
  code: string
  type: string
  value: number
  min_amount: number | null
  product_id: string | null
  sold_out: boolean
  already_used: boolean
}

type RefInfo = { type: string; value: number; min_amount: number | null; product_id: string | null }

export function useAutoDiscounts() {
  const { data: session } = useSession()
  const [codes, setCodes] = useState<AutoPreviewCode[] | null>(null)
  const [refInfo, setRefInfo] = useState<RefInfo | null>(null)

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

  // Resolve the affiliate ref code remembered for this session (if any).
  useEffect(() => {
    let cancelled = false
    let code: string | null = null
    try {
      code = sessionStorage.getItem("aff_ref")
    } catch { /* storage disabled */ }
    if (!code) {
      setRefInfo(null)
      return
    }
    fetch(`/api/discount-codes/resolve?code=${encodeURIComponent(code)}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return
        setRefInfo(d?.found ? { type: d.type, value: d.value, min_amount: d.min_amount, product_id: d.product_id } : null)
      })
      .catch(() => { if (!cancelled) setRefInfo(null) })
    return () => { cancelled = true }
  }, [])

  // Best discounted price for one variant, or null if nothing applies. The
  // affiliate ref code (from their link) takes priority over global auto codes.
  const bestDiscountedPrice = useCallback(
    (productId: string, price: number): number | null => {
      // 1) Affiliate ref code wins when it applies to this product + price.
      if (refInfo && (refInfo.product_id === null || refInfo.product_id === productId)) {
        const off = previewDiscountAmount(
          { type: refInfo.type, value: refInfo.value, minAmount: refInfo.min_amount },
          price,
        )
        if (off > 0) {
          const discounted = Math.round((price - off) * 100) / 100
          if (discounted < price) return discounted
        }
      }
      // 2) Fall back to the best global auto-select code.
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
    [codes, refInfo],
  )

  return { bestDiscountedPrice }
}
