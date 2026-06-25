"use client"

import { useState, useMemo } from "react"
import { format } from "date-fns"
import { useTranslations, useLocale } from "next-intl"
import { th, enUS } from "date-fns/locale"
import { getImageUrl } from "@/lib/getImageUrl"
import { useSession } from "next-auth/react"
import ManualOrderModal from "./ManualOrderModal"

export default function AdminOrdersClient({ orders }: { orders: any[] }) {
  const { data: session } = useSession()
  const t = useTranslations("Admin")
  const locale = useLocale()
  const dateLocale = locale === "th" ? th : enUS

  const [search, setSearch] = useState("")
  const [productFilter, setProductFilter] = useState<string>("all")
  const [wlFilter, setWlFilter] = useState("all")
  const [updating, setUpdating] = useState<string | null>(null)
  const [manualOpen, setManualOpen] = useState(false)

  const productOptions = useMemo(() => {
    const seen = new Map<string, { id: string; name_en: string; name_th: string; count: number }>()
    for (const o of orders) {
      if (!o.product_id || !o.products) continue
      const existing = seen.get(o.product_id)
      if (existing) existing.count++
      else seen.set(o.product_id, {
        id: o.product_id,
        name_en: o.products.name_en ?? "—",
        name_th: o.products.name_th ?? "—",
        count: 1,
      })
    }
    return Array.from(seen.values()).sort((a, b) => b.count - a.count)
  }, [orders])

  const filtered = useMemo(() => {
    return orders
      .filter((o) => productFilter === "all" || o.product_id === productFilter)
      .filter((o) => wlFilter === "all" || o.whitelist_status === wlFilter)
      .filter((o) => {
        const q = search.toLowerCase()
        const productName = (locale === "th" ? o.products?.name_th : o.products?.name_en) || ""
        return (
          (o.whitelisted_username ?? "").toLowerCase().includes(q) ||
          (o.users?.username ?? "").toLowerCase().includes(q) ||
          (o.buyer_label ?? "").toLowerCase().includes(q) ||
          productName.toLowerCase().includes(q)
        )
      })
  }, [orders, search, productFilter, wlFilter, locale])

  const handleWhitelistStatus = async (id: string, whitelist_status: string) => {
    setUpdating(id)
    await fetch(`/api/admin/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ whitelist_status }),
    })
    setUpdating(null)
    window.location.reload()
  }

  const pendingWl = orders.filter(
    (o) => o.status === "paid" && o.whitelist_status === "pending"
  ).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-bold">{t("orders")}</h1>
          <p className="text-text-muted text-[13px] mt-0.5">{orders.length} {t("total")}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {pendingWl > 0 && (
            <div className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-xl px-4 py-2.5">
              <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
              <span className="text-[13px] text-orange-400 font-medium">
                {t("pending_whitelist", { count: pendingWl })}
              </span>
            </div>
          )}
          {session?.user?.role === "admin" && (
            <button
              onClick={() => setManualOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-accent text-white text-[13px] font-medium hover:opacity-90 active:scale-95 transition"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              {t("add_manual_order")}
            </button>
          )}
        </div>
      </div>

      <ManualOrderModal
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        onCreated={() => window.location.reload()}
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("search_orders")}
          className="flex-1 min-w-[200px] bg-bg-card border border-accent/15 rounded-xl px-4 py-2.5 text-[13px] placeholder:text-text-muted outline-none focus:border-accent/40"
        />
        <div className="flex gap-1 bg-bg-card border border-accent/15 rounded-xl p-1">
          {["all", "pending", "whitelisted", "removed"].map((f) => (
            <button key={f} onClick={() => setWlFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition capitalize ${wlFilter === f ? "bg-orange-500/20 text-orange-400" : "text-text-muted hover:text-text-base"
                }`}>
              {t(f)}
            </button>
          ))}
        </div>
      </div>

      {/* Game filter */}
      {productOptions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setProductFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition ${
              productFilter === "all"
                ? "bg-accent/20 text-accent-light border border-accent/30"
                : "bg-bg-card border border-accent/15 text-text-muted hover:text-text-base"
            }`}
          >
            {t("all")} <span className="opacity-60">({orders.length})</span>
          </button>
          {productOptions.map((p) => (
            <button
              key={p.id}
              onClick={() => setProductFilter(p.id)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition ${
                productFilter === p.id
                  ? "bg-accent/20 text-accent-light border border-accent/30"
                  : "bg-bg-card border border-accent/15 text-text-muted hover:text-text-base"
              }`}
            >
              {locale === "th" ? p.name_th : p.name_en} <span className="opacity-60">({p.count})</span>
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="bg-bg-card border border-accent/10 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] text-text-muted border-b border-white/5 bg-white/[0.02]">
                <th className="px-5 py-3.5 font-medium">{t("user")}</th>
                <th className="px-4 py-3.5 font-medium">{t("product")}</th>
                <th className="px-4 py-3.5 font-medium">{t("in_game_username")}</th>
                <th className="px-4 py-3.5 font-medium">{t("amount")}</th>
                <th className="px-4 py-3.5 font-medium">{t("payment")}</th>
                <th className="px-4 py-3.5 font-medium">{t("order_status")}</th>
                <th className="px-4 py-3.5 font-medium">{t("whitelist")}</th>
                <th className="px-4 py-3.5 font-medium">{t("date")}</th>
                <th className="px-4 py-3.5 font-medium">{t("actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-text-muted">
                    {t("no_orders")}
                  </td>
                </tr>
              )}
              {filtered.map((o) => (
                <tr key={o.id} className="hover:bg-white/[0.02] transition">
                  {/* User */}
                  <td className="px-5 py-4">
                    {o.recorded_by_id ? (
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-yellow-500/15 border border-yellow-500/30 flex items-center justify-center text-[10px] font-bold text-yellow-500">
                          M
                        </div>
                        <div>
                          <p className="text-text-base">{o.buyer_label ?? "—"}</p>
                          <p className="text-[11px] text-yellow-500/80 font-medium">
                            {t("manual_badge")} · {o.recorded_by?.username ?? "—"}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        {o.users?.avatar ? (
                          <img src={o.users.avatar} className="w-6 h-6 rounded-full object-cover" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center text-[10px]">
                            {o.users?.username?.[0]?.toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p>{o.users?.username ?? "—"}</p>
                          <p className="text-[11px] text-text-muted">{o.users?.email ?? ""}</p>
                        </div>
                      </div>
                    )}
                  </td>

                  {/* Product */}
                  <td className="px-4 py-4">
                    <p className="text-text-base">{locale === "th" ? o.products?.name_th : o.products?.name_en ?? "—"}</p>
                    <p className="text-[11px] text-text-muted">{locale === "th" ? o.product_variants?.label_th : o.product_variants?.label_en ?? ""}</p>
                  </td>

                  {/* In-Game Username */}
                  <td className="px-4 py-4">
                    {o.whitelisted_username ? (
                      <span className="font-mono text-[13px] bg-bg-base px-2 py-1 rounded-lg text-accent-light">
                        {o.whitelisted_username}
                      </span>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </td>

                  {/* Amount */}
                  <td className="px-4 py-4 font-semibold text-accent-light">
                    ฿{o.amount.toLocaleString()}
                  </td>

                  {/* Payment Method */}
                  <td className="px-4 py-4">
                    {(() => {
                      const pm = o.payment_method || "stripe"
                      const palette: Record<string, { bg: string; color: string; label: string }> = {
                        promptpay: { bg: "rgba(27,167,225,.15)",  color: "#1ba7e1", label: t("channel_promptpay") },
                        paypal:    { bg: "rgba(0,156,222,.15)",   color: "#009cde", label: t("channel_paypal") },
                        discord:   { bg: "rgba(88,101,242,.15)",  color: "#5865f2", label: t("channel_discord") },
                        cash:      { bg: "rgba(62,207,142,.15)",  color: "#3ecf8e", label: t("channel_cash") },
                        transfer:  { bg: "rgba(240,192,96,.15)",  color: "#f0c060", label: t("channel_transfer") },
                        other:     { bg: "rgba(122,155,184,.15)", color: "#7a9bb8", label: t("channel_other") },
                      }
                      const v = palette[pm] || { bg: "rgba(103,114,229,.15)", color: "#6772e5", label: t("card") }
                      return (
                        <span className="text-[11px] px-2 py-0.5 rounded-full capitalize"
                          style={{ background: v.bg, color: v.color }}>
                          {v.label}
                        </span>
                      )
                    })()}
                  </td>

                  {/* Order Status */}
                  <td className="px-4 py-4">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${o.status === "paid" ? "bg-green-500/15 text-green-400" :
                        o.status === "pending" ? "bg-orange-500/15 text-orange-400" :
                          o.status === "expired" ? "bg-red-500/15 text-red-400" :
                            "bg-white/5 text-text-muted"
                      }`}>
                      {t(o.status)}
                    </span>
                  </td>

                  {/* Whitelist Status */}
                  <td className="px-4 py-4">
                    {o.status === "paid" ? (
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${o.whitelist_status === "whitelisted" ? "bg-green-500/15 text-green-400" :
                          o.whitelist_status === "removed" ? "bg-red-500/15 text-red-400" :
                            "bg-orange-500/15 text-orange-400"
                        }`}>
                        {o.whitelist_status ? t(o.whitelist_status) : t("pending")}
                      </span>
                    ) : (
                      <span className="text-text-muted text-[11px]">—</span>
                    )}
                  </td>

                  {/* Date */}
                  <td className="px-4 py-4 text-text-muted whitespace-nowrap text-[12px]">
                    {o.created_at ? format(new Date(o.created_at), "dd MMM HH:mm", { locale: dateLocale }) : "—"}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-4">
                    {o.status === "paid" && (
                      <div className="flex flex-col gap-1.5">
                        {(!o.whitelist_status || o.whitelist_status === "pending") && session?.user?.role === "admin" && (
                          <button
                            onClick={() => handleWhitelistStatus(o.id, "whitelisted")}
                            disabled={updating === o.id}
                            className="text-[11px] px-3 py-1.5 rounded-lg bg-green-500/15 text-green-400 hover:bg-green-500/25 transition disabled:opacity-40 whitespace-nowrap"
                          >
                            {updating === o.id ? "..." : t("mark_whitelisted")}
                          </button>
                        )}
                        {o.whitelist_status === "whitelisted" && session?.user?.role === "admin" && (
                          <button
                            onClick={() => handleWhitelistStatus(o.id, "removed")}
                            disabled={updating === o.id}
                            className="text-[11px] px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 transition disabled:opacity-40 whitespace-nowrap"
                          >
                            {updating === o.id ? "..." : t("remove")}
                          </button>
                        )}
                        {o.whitelist_status === "removed" && (
                          <button
                            onClick={() => handleWhitelistStatus(o.id, "whitelisted")}
                            disabled={updating === o.id}
                            className="text-[11px] px-3 py-1.5 rounded-lg bg-green-500/15 text-green-400 hover:bg-green-500/25 transition disabled:opacity-40 whitespace-nowrap"
                          >
                            {updating === o.id ? "..." : t("re_whitelist")}
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}