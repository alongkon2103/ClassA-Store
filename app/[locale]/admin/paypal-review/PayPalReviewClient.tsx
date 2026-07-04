"use client"

// Admin review queue for PayPal.me payments the worker couldn't auto-approve.
// For each payment the admin can either approve it into a chosen pending order
// (which unlocks whitelist) or dismiss it (unrelated income / spam).

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"

type QueueItem = {
  id: string
  txn_id: string
  gross_amount: number
  currency: string
  sender_name: string | null
  payment_status: string
  match_status: string
  review_reason: string | null
  created_at: string
  matched_order_id: string | null
  matched_order_ign: string | null
}

type ResolvedItem = {
  id: string
  txn_id: string
  gross_amount: number
  currency: string
  sender_name: string | null
  match_status: string
  processed_at: string | null
}

type OrderOption = {
  id: string
  expected_amount: number | null
  expected_currency: string | null
  whitelisted_username: string | null
  username: string | null
  email: string | null
  product: string | null
  variant: string | null
  created_at: string | null
  expires_at: string | null
}

const money = (a: number, c: string) => `${c === "THB" ? "฿" : c === "USD" ? "$" : ""}${a.toFixed(2)} ${c}`

function statusBadge(status: string): { label: string; cls: string } {
  switch (status) {
    case "pending":
      return { label: "PENDING", cls: "bg-yellow-500/15 text-yellow-400" }
    case "no_order":
      return { label: "NO ORDER", cls: "bg-red-500/15 text-red-400" }
    case "ambiguous":
      return { label: "AMBIGUOUS", cls: "bg-orange-500/15 text-orange-400" }
    case "late":
      return { label: "LATE", cls: "bg-purple-500/15 text-purple-400" }
    case "matched":
      return { label: "AUTO", cls: "bg-green-500/15 text-green-400" }
    case "manual":
      return { label: "MANUAL", cls: "bg-sky-500/15 text-sky-400" }
    case "dismissed":
      return { label: "DISMISSED", cls: "bg-white/10 text-text-muted" }
    default:
      return { label: status.toUpperCase(), cls: "bg-white/10 text-text-muted" }
  }
}

export default function PayPalReviewClient({
  queue,
  resolved,
  orders,
}: {
  queue: QueueItem[]
  resolved: ResolvedItem[]
  orders: OrderOption[]
}) {
  const t = useTranslations("Admin")
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  // paymentId → chosen orderId for the approve dropdown
  const [chosen, setChosen] = useState<Record<string, string>>({})

  const orderLabel = (o: OrderOption) => {
    const amt = o.expected_amount != null ? money(o.expected_amount, o.expected_currency ?? "USD") : "—"
    const who = o.whitelisted_username || o.username || o.email || "?"
    const short = o.id.slice(0, 8)
    return `${amt} · ${who} · ${o.product ?? ""}${o.variant ? " (" + o.variant + ")" : ""} · ${short}`
  }

  // Suggest orders whose amount equals the payment (helps the admin spot the
  // right one for "late"/"ambiguous" cases) by sorting exact matches first.
  const ordersForPayment = (p: QueueItem) =>
    [...orders].sort((a, b) => {
      const am = a.expected_amount === p.gross_amount && a.expected_currency === p.currency ? 0 : 1
      const bm = b.expected_amount === p.gross_amount && b.expected_currency === p.currency ? 0 : 1
      return am - bm
    })

  const act = async (paymentId: string, action: "approve" | "dismiss") => {
    if (action === "approve" && !chosen[paymentId]) {
      alert(t("ppr_pick_order_first"))
      return
    }
    if (action === "dismiss" && !confirm(t("ppr_confirm_dismiss"))) return

    setBusyId(paymentId)
    try {
      const res = await fetch("/api/admin/paypal-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          paymentId,
          orderId: action === "approve" ? chosen[paymentId] : undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(data.error || "Failed")
      } else {
        router.refresh()
      }
    } catch {
      alert("Network error")
    } finally {
      setBusyId(null)
    }
  }

  const hasQueue = queue.length > 0

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-[24px] font-bold flex items-center gap-2">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
          {t("ppr_title")}
        </h1>
        <p className="text-[13px] text-text-muted mt-1">{t("ppr_subtitle")}</p>
      </div>

      {/* QUEUE */}
      <section className="space-y-3">
        <h2 className="text-[14px] font-bold text-text-base flex items-center gap-2">
          {t("ppr_queue_heading")}
          <span className={`text-[11px] px-2 py-0.5 rounded-full ${hasQueue ? "bg-yellow-500/15 text-yellow-400" : "bg-green-500/15 text-green-400"}`}>
            {queue.length}
          </span>
        </h2>

        {!hasQueue ? (
          <div className="bg-bg-card border border-white/5 rounded-2xl p-8 text-center text-[13px] text-text-muted">
            {t("ppr_empty")}
          </div>
        ) : (
          <div className="space-y-3">
            {queue.map((p) => {
              const badge = statusBadge(p.match_status)
              const busy = busyId === p.id
              return (
                <div key={p.id} className="bg-bg-card border border-white/10 rounded-2xl p-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[18px] font-bold text-accent-light">
                          {money(p.gross_amount, p.currency)}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.cls}`}>
                          {badge.label}
                        </span>
                        {p.payment_status !== "completed" && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-text-muted">
                            {p.payment_status.toUpperCase()}
                          </span>
                        )}
                      </div>
                      <p className="text-[12px] text-text-muted mt-1">
                        {t("ppr_from")}: <span className="text-text-base">{p.sender_name || "—"}</span>
                        {" · "}
                        {new Date(p.created_at).toLocaleString()}
                      </p>
                      <p className="text-[11px] text-text-muted font-mono mt-0.5">txn {p.txn_id}</p>
                      {p.review_reason && (
                        <p className="text-[11px] text-yellow-400/80 mt-1">↳ {p.review_reason}</p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-white/5">
                    <select
                      value={chosen[p.id] ?? ""}
                      onChange={(e) => setChosen((s) => ({ ...s, [p.id]: e.target.value }))}
                      disabled={busy}
                      className="flex-1 bg-bg-base border border-white/10 rounded-xl px-3 py-2 text-[12px] outline-none focus:border-accent/40 transition"
                    >
                      <option value="">{t("ppr_select_order")}</option>
                      {ordersForPayment(p).map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.expected_amount === p.gross_amount && o.expected_currency === p.currency ? "✓ " : ""}
                          {orderLabel(o)}
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <button
                        onClick={() => act(p.id, "approve")}
                        disabled={busy}
                        className="px-4 py-2 rounded-xl bg-accent text-white text-[13px] font-bold hover:opacity-90 active:scale-95 transition disabled:opacity-50 whitespace-nowrap"
                      >
                        {busy ? "…" : t("ppr_approve")}
                      </button>
                      <button
                        onClick={() => act(p.id, "dismiss")}
                        disabled={busy}
                        className="px-4 py-2 rounded-xl bg-white/5 text-text-muted text-[13px] font-medium hover:bg-white/10 hover:text-text-base active:scale-95 transition disabled:opacity-50 whitespace-nowrap"
                      >
                        {t("ppr_dismiss")}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* RECENT HISTORY */}
      {resolved.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-[14px] font-bold text-text-base">{t("ppr_history_heading")}</h2>
          <div className="bg-bg-card border border-white/5 rounded-2xl overflow-hidden">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-text-muted border-b border-white/5">
                  <th className="text-left font-medium px-4 py-2.5">{t("ppr_col_amount")}</th>
                  <th className="text-left font-medium px-4 py-2.5">{t("ppr_from")}</th>
                  <th className="text-left font-medium px-4 py-2.5">{t("ppr_col_status")}</th>
                  <th className="text-left font-medium px-4 py-2.5 hidden sm:table-cell">{t("ppr_col_when")}</th>
                </tr>
              </thead>
              <tbody>
                {resolved.map((r) => {
                  const badge = statusBadge(r.match_status)
                  return (
                    <tr key={r.id} className="border-b border-white/[0.03] last:border-0">
                      <td className="px-4 py-2.5 font-medium">{money(r.gross_amount, r.currency)}</td>
                      <td className="px-4 py-2.5 text-text-muted">{r.sender_name || "—"}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-text-muted hidden sm:table-cell">
                        {r.processed_at ? new Date(r.processed_at).toLocaleString() : "—"}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
