"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import Navbar from "@/components/Navbar"

type Data = {
  profile: {
    default_commission_pct: number
    payout_method: string | null
    payout_detail: string | null
    display_name: string | null
    is_active: boolean
  }
  totals: { pending: number; paid: number; sales_count: number }
  codes: {
    code: string; type: string; value: number; commission_pct: number | null
    is_active: boolean; used_count: number; max_uses: number | null; product_name: string | null
  }[]
  earnings: {
    id: string; base_amount: number; commission_pct: number; commission_amount: number
    status: string; created_at: string; paid_at: string | null; product_name: string | null
  }[]
  payouts: { id: string; amount: number; method: string | null; paid_at: string }[]
}

const baht = (n: number) => `฿${n.toLocaleString(undefined, { minimumFractionDigits: 2 })}`

export default function AffiliateDashboard() {
  const t = useTranslations("Affiliate")
  const [d, setD] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/affiliate/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { setD(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const origin = typeof window !== "undefined" ? window.location.origin : ""
  const copy = (code: string) => {
    navigator.clipboard?.writeText(`${origin}/r/${code}`)
    setCopied(code)
    setTimeout(() => setCopied(null), 1500)
  }

  return (
    <>
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div>
          <h1 className="text-[24px] font-bold">{t("title")}</h1>
          <p className="text-text-muted text-[13px] mt-0.5">
            {d?.profile.display_name ? `${d.profile.display_name} · ` : ""}
            {t("subtitle", { pct: d?.profile.default_commission_pct ?? 0 })}
          </p>
        </div>

        {loading ? (
          <p className="text-text-muted py-16 text-center">{t("loading")}</p>
        ) : !d ? (
          <p className="text-text-muted py-16 text-center">{t("error")}</p>
        ) : (
          <>
            {/* Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Stat label={t("pending")} value={baht(d.totals.pending)} color="text-amber-400" />
              <Stat label={t("paid")} value={baht(d.totals.paid)} color="text-green-400" />
              <Stat label={t("sales")} value={String(d.totals.sales_count)} color="text-text-base" />
            </div>

            {!d.profile.is_active && (
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl px-5 py-3 text-[13px] text-amber-500/90">
                {t("paused_notice")}
              </div>
            )}

            {/* Codes + links */}
            <section className="bg-bg-card border border-accent/10 rounded-2xl p-5">
              <p className="text-[11px] uppercase tracking-widest text-text-muted mb-3">{t("your_codes")}</p>
              {d.codes.length === 0 ? (
                <p className="text-[13px] text-text-muted">{t("no_codes")}</p>
              ) : (
                <div className="space-y-2">
                  {d.codes.map((c) => (
                    <div key={c.code} className="flex flex-wrap items-center justify-between gap-2 bg-bg-base border border-white/5 rounded-xl px-3 py-2.5">
                      <div className="min-w-0">
                        <span className="font-mono font-semibold text-[14px]">{c.code}</span>
                        <span className="text-[12px] text-text-muted ml-2">
                          {t("gives")} −{c.type === "fixed" ? `฿${c.value}` : `${c.value}%`}
                          {c.product_name ? ` · ${c.product_name}` : ` · ${t("all_products")}`}
                          {!c.is_active ? ` · ${t("inactive")}` : ""}
                        </span>
                      </div>
                      <button
                        onClick={() => copy(c.code)}
                        className="shrink-0 text-[12px] px-3 py-1.5 rounded-lg bg-accent/15 text-accent-light hover:bg-accent/25 transition"
                      >
                        {copied === c.code ? t("copied") : t("copy_link")}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Sales log — no buyer identity */}
            <section className="bg-bg-card border border-accent/10 rounded-2xl overflow-hidden">
              <p className="text-[11px] uppercase tracking-widest text-text-muted px-5 pt-5 pb-2">{t("sales_log")}</p>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px] min-w-[520px]">
                  <thead>
                    <tr className="text-left text-[11px] text-text-muted border-b border-white/5">
                      <th className="px-5 py-2.5 font-medium">{t("col_date")}</th>
                      <th className="px-4 py-2.5 font-medium">{t("col_product")}</th>
                      <th className="px-4 py-2.5 font-medium text-right">{t("col_sale")}</th>
                      <th className="px-4 py-2.5 font-medium text-right">{t("col_commission")}</th>
                      <th className="px-4 py-2.5 font-medium">{t("col_status")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {d.earnings.length === 0 ? (
                      <tr><td colSpan={5} className="text-center py-10 text-text-muted">{t("no_sales")}</td></tr>
                    ) : d.earnings.map((e) => (
                      <tr key={e.id} className="hover:bg-white/[0.02]">
                        <td className="px-5 py-2.5 text-text-muted">{new Date(e.created_at).toLocaleDateString()}</td>
                        <td className="px-4 py-2.5">{e.product_name ?? "—"}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-text-muted">{baht(e.base_amount)}</td>
                        <td className="px-4 py-2.5 text-right font-mono font-semibold">{baht(e.commission_amount)}</td>
                        <td className="px-4 py-2.5">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            e.status === "paid" ? "bg-green-500/15 text-green-400"
                            : e.status === "reversed" ? "bg-white/10 text-text-muted"
                            : "bg-amber-500/15 text-amber-400"}`}>
                            {t(`status_${e.status}`)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Payout history */}
            {d.payouts.length > 0 && (
              <section className="bg-bg-card border border-accent/10 rounded-2xl p-5">
                <p className="text-[11px] uppercase tracking-widest text-text-muted mb-3">{t("payout_history")}</p>
                <div className="space-y-1.5">
                  {d.payouts.map((p) => (
                    <div key={p.id} className="flex items-center justify-between text-[13px]">
                      <span className="text-text-muted">
                        {new Date(p.paid_at).toLocaleDateString()}{p.method ? ` · ${p.method}` : ""}
                      </span>
                      <span className="font-mono font-semibold text-green-400/90">{baht(p.amount)}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-bg-card border border-accent/10 rounded-2xl p-5">
      <p className="text-[11px] tracking-widest text-text-muted uppercase mb-2">{label}</p>
      <p className={`text-[24px] font-bold ${color}`}>{value}</p>
    </div>
  )
}
