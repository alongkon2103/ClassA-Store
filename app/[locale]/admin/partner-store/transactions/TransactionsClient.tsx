"use client"

import { Fragment, useState } from "react"
import { useTranslations, useLocale } from "next-intl"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any
type Store = {
  id: string; display_name: string; ref_slug: string | null; site_url: string | null
  last_synced_at: string | null; totals: Any; sales: Any[]; payouts: Any[]
}

// The partner earnings shapes aren't contract-fixed, so read defensively.
const pick = (o: Any, keys: string[]): Any => {
  if (!o || typeof o !== "object") return undefined
  for (const k of keys) if (o[k] != null) return o[k]
  return undefined
}
const asMoney = (v: Any) => (typeof v === "number" ? `฿${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : v ?? "—")

export default function TransactionsClient({ stores }: { stores: Store[] }) {
  const t = useTranslations("Admin")
  const locale = useLocale()
  const [rawOpen, setRawOpen] = useState<string | null>(null)

  const fmtDate = (v: Any) => {
    if (!v) return "—"
    const d = new Date(v)
    return isNaN(d.getTime()) ? String(v) : d.toLocaleString(locale === "th" ? "th-TH" : "en-US")
  }

  return (
    <div className="p-5 sm:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-text-base">{t("partner_transactions")}</h1>
        <p className="text-[13px] text-text-muted mt-1">{t("transactions_desc")}</p>
      </div>

      {stores.map((store) => {
        const tot = store.totals ?? {}
        const salesCount = pick(tot, ["sales_count", "count"]) ?? store.sales.length
        const pending = pick(tot, ["pending", "pending_thb"])
        const paid = pick(tot, ["paid", "paid_thb"])
        const reversed = pick(tot, ["reversed", "reversed_thb"])
        const salesAmount = pick(tot, ["sales_amount", "amount"])

        return (
          <div key={store.id} className="bg-bg-card border border-accent/10 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-white/5 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase bg-violet-500 text-white px-2 py-0.5 rounded-full">Partner</span>
                <p className="text-[15px] font-bold text-text-base">{store.display_name}</p>
                <span className="text-[12px] text-text-muted">ref: {store.ref_slug ?? "—"}</span>
              </div>
              <span className="text-[12px] text-text-muted">
                {store.last_synced_at ? `${t("last_synced")}: ${fmtDate(store.last_synced_at)}` : t("never_synced")}
              </span>
            </div>

            {/* Totals */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-px bg-white/5">
              {[
                { label: t("sales_count"), val: salesCount ?? 0 },
                { label: t("amount"), val: asMoney(salesAmount) },
                { label: t("realized"), val: asMoney(paid), cls: "text-green-400" },
                { label: t("pending"), val: asMoney(pending), cls: "text-yellow-400" },
                { label: t("reversed"), val: asMoney(reversed), cls: "text-red-400" },
              ].map((c, i) => (
                <div key={i} className="bg-bg-card p-4">
                  <p className="text-[11px] text-text-muted">{c.label}</p>
                  <p className={`text-[16px] font-bold mt-0.5 ${c.cls ?? "text-text-base"}`}>{c.val}</p>
                </div>
              ))}
            </div>

            {/* Sales list */}
            {store.sales.length === 0 ? (
              <p className="p-5 text-[13px] text-text-muted">{t("no_transactions")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px] min-w-[640px]">
                  <thead>
                    <tr className="text-left text-[11px] text-text-muted border-b border-white/5">
                      <th className="px-5 py-3 font-medium">{t("date")}</th>
                      <th className="px-3 py-3 font-medium">{t("game")}</th>
                      <th className="px-3 py-3 font-medium">{t("amount")}</th>
                      <th className="px-3 py-3 font-medium">{t("commission")}</th>
                      <th className="px-3 py-3 font-medium">{t("status")}</th>
                      <th className="px-5 py-3 font-medium text-right">{t("raw")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {store.sales.map((s, i) => {
                      const rid = `${store.id}-${i}`
                      return (
                        <Fragment key={rid}>
                          <tr className="hover:bg-white/[0.02]">
                            <td className="px-5 py-3 whitespace-nowrap text-text-muted">{fmtDate(pick(s, ["created_at", "date", "paid_at", "time"]))}</td>
                            <td className="px-3 py-3">{pick(s, ["game", "product", "product_name", "name", "slug", "game_slug"]) ?? "—"}</td>
                            <td className="px-3 py-3">{asMoney(pick(s, ["amount", "price", "price_thb", "sales_amount"]))}</td>
                            <td className="px-3 py-3 text-green-400">{asMoney(pick(s, ["commission", "commission_thb", "commission_amount"]))}</td>
                            <td className="px-3 py-3">{pick(s, ["status", "state"]) ?? "—"}</td>
                            <td className="px-5 py-3 text-right">
                              <button onClick={() => setRawOpen(rawOpen === rid ? null : rid)} className="text-[12px] text-accent-light hover:underline">{"{ }"}</button>
                            </td>
                          </tr>
                          {rawOpen === rid && (
                            <tr>
                              <td colSpan={6} className="px-5 py-3 bg-bg-base/50">
                                <pre className="text-[11px] text-text-muted overflow-x-auto whitespace-pre-wrap">{JSON.stringify(s, null, 2)}</pre>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Payouts */}
            {store.payouts.length > 0 && (
              <div className="p-5 border-t border-white/5">
                <p className="text-[13px] font-semibold text-text-base mb-2">{t("payouts")}</p>
                <div className="space-y-1">
                  {store.payouts.map((p, i) => (
                    <div key={i} className="flex justify-between text-[13px]">
                      <span className="text-text-muted">{fmtDate(pick(p, ["created_at", "date", "paid_at"]))}</span>
                      <span className="text-text-base">{asMoney(pick(p, ["amount", "amount_thb"]))} · {pick(p, ["status", "state"]) ?? "—"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}

      {stores.length === 0 && <p className="text-[13px] text-text-muted">{t("no_partner_products")}</p>}
    </div>
  )
}
