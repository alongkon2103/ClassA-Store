"use client"

import { useState, useEffect } from "react"
import { useTranslations } from "next-intl"

type Partner = {
  id: string
  name: string
}

type ProductShare = {
  partner_id: string
  share_pct: string | number
}

type Props = {
  productId: string
  allPartners: Partner[]
  initialShares: ProductShare[]
  onUpdate: (shares: ProductShare[]) => void
}

export default function PartnershipManager({
  allPartners,
  initialShares,
  onUpdate
}: Props) {
  const t = useTranslations("AdminPartners")
  const [shares, setShares] = useState<ProductShare[]>(
    initialShares.length > 0 ? initialShares : []
  )

  useEffect(() => {
    onUpdate(shares)
  }, [shares])

  const addShare = () => {
    if (allPartners.length === 0) return
    setShares([...shares, { partner_id: allPartners[0].id, share_pct: "" }])
  }

  const removeShare = (idx: number) => {
    setShares(shares.filter((_, i) => i !== idx))
  }

  const updateShare = (idx: number, key: keyof ProductShare, value: string) => {
    const newShares = [...shares]
    newShares[idx] = { ...newShares[idx], [key]: value }
    setShares(newShares)
  }

  const totalShare = shares.reduce((sum, s) => sum + Number(s.share_pct || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[16px] font-bold text-text-base">{t("tab_partnership_title")}</h3>
          <p className="text-[13px] text-text-muted mt-0.5">{t("tab_partnership_desc")}</p>
        </div>
        <button
          onClick={addShare}
          className="bg-accent/20 hover:bg-accent/30 text-accent-light text-[13px] font-medium px-4 py-2 rounded-xl transition"
        >
          {t("add_partner")}
        </button>
      </div>

      <div className="space-y-3">
        {shares.length === 0 ? (
          <div className="text-center py-10 bg-bg-base border border-accent/10 border-dashed rounded-2xl text-text-muted text-[13px]">
            {t("no_shares")}
          </div>
        ) : (
          shares.map((share, idx) => (
            <div key={idx} className="bg-bg-card border border-accent/10 rounded-2xl p-4 flex items-center gap-4">
              <div className="flex-1">
                <label className="block text-[11px] text-text-muted uppercase mb-1.5">{t("col_name")}</label>
                <select
                  value={share.partner_id}
                  onChange={(e) => updateShare(idx, "partner_id", e.target.value)}
                  className={input}
                >
                  {allPartners.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="w-32">
                <label className="block text-[11px] text-text-muted uppercase mb-1.5">{t("share_pct")}</label>
                <div className="relative">
                  <input
                    type="number"
                    value={share.share_pct}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => updateShare(idx, "share_pct", e.target.value)}
                    className={input}
                    placeholder="e.g. 50"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-[12px]">%</span>
                </div>
              </div>
              <button
                onClick={() => removeShare(idx)}
                className="mt-6 p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
          ))
        )}
      </div>

      {shares.length > 0 && (
        <div className={`p-4 rounded-xl border text-[13px] flex items-center gap-3 ${
          totalShare === 100 ? "bg-green-500/5 border-green-500/20 text-green-400" : "bg-orange-500/5 border-orange-500/20 text-orange-400"
        }`}>
          <div className="font-bold">{t("total_share", { total: totalShare })}</div>
          {totalShare !== 100 && (
            <p className="flex-1">{t("total_share_warning")}</p>
          )}
        </div>
      )}
    </div>
  )
}

const input = "w-full bg-bg-base border border-accent/15 rounded-xl px-4 py-2.5 text-[13px] text-text-base outline-none focus:border-accent/40 transition"
