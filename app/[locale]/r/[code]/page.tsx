"use client"

// Affiliate referral landing: /r/<CODE>
// Remembers the affiliate's code (last-click — a newer link overwrites an older
// one) then sends the shopper into the shop, where the product modal auto-applies
// it. Attribution stays code-based: credit is decided by the code on the paid
// order, so this page only ever pre-fills a convenience code.

import { useEffect } from "react"
import { useParams } from "next/navigation"
import { useRouter } from "@/i18n/routing"

export const AFF_REF_KEY = "aff_ref"

export default function AffiliateRefLanding() {
  const params = useParams()
  const router = useRouter()

  useEffect(() => {
    const raw = params?.code
    const code = (Array.isArray(raw) ? raw[0] : raw)?.toString().trim().toUpperCase()
    if (code) {
      try {
        localStorage.setItem(AFF_REF_KEY, code)
      } catch { /* private mode / storage disabled — ignore, code just won't persist */ }
    }
    router.replace("/products")
  }, [params, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-base">
      <div className="flex items-center gap-3 text-text-muted text-[14px]">
        <span className="w-4 h-4 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
        กำลังพาไปที่ร้าน...
      </div>
    </div>
  )
}
