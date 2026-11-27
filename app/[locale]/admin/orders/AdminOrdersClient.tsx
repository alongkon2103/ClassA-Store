"use client"

import { useState, useMemo } from "react"
import { format } from "date-fns"
import { useTranslations, useLocale } from "next-intl"
import { th, enUS } from "date-fns/locale"
import { useSession } from "next-auth/react"
import ManualOrderModal from "./ManualOrderModal"
import { useRouter } from "@/i18n/routing"
import { filterOrders, deliveryStatusLabel, DELIVERY_STATUSES, type OrderFilters } from "./order-list-model"
import { getListPage, productName } from "../products/product-list-model"

type AdminOrder = {
  id: string
  product_id: string
  amount: number
  status: string
  payment_method: string | null
  whitelist_status: string | null
  whitelisted_username: string | null
  buyer_label: string | null
  recorded_by_id: string | null
  created_at: string | null
  users: { username: string; avatar: string | null; email: string | null } | null
  products: { name_en: string; name_th: string; type: string } | null
  product_variants: { label_en: string; label_th: string } | null
  recorded_by: { username: string; avatar: string | null } | null
}

export default function AdminOrdersClient({ orders }: { orders: AdminOrder[] }) {
  const { data: session } = useSession()
  const t = useTranslations("Admin")
  const locale = useLocale()
  const isTH = locale === "th"
  const dateLocale = locale === "th" ? th : enUS
  const router = useRouter()

  const [search, setSearch] = useState("")
  const [productFilter, setProductFilter] = useState<string>("all")
  const [wlFilter, setWlFilter] = useState("all")
  const [sort, setSort] = useState<OrderFilters["sort"]>("newest")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [updating, setUpdating] = useState<string | null>(null)
  const [manualOpen, setManualOpen] = useState(false)
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null)
  const control = "w-full min-w-0 rounded-lg border border-border-soft bg-bg-input px-3 py-2.5 text-[13px] text-text-base outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25"
  const quietButton = "rounded-lg border border-border-soft px-3 py-2 text-[12px] text-text-base transition hover:bg-bg-card-hover focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-40 disabled:cursor-not-allowed"

  const productOptions = useMemo(() => {
    const seen = new Map<string, { id: string; name_en: string; name_th: string; count: number }>()
    for (const o of orders) {
      if (!o.product_id || !o.products) continue
      const existing = seen.get(o.product_id)
      if (existing) existing.count++
      else seen.set(o.product_id, {
        id: o.product_id,
        name_en: o.products.name_en || o.products.name_th || "—",
        name_th: o.products.name_th || o.products.name_en || "—",
        count: 1,
      })
    }
    return Array.from(seen.values()).sort((a, b) => productName(a, locale).localeCompare(productName(b, locale), locale))
  }, [orders, locale])

  const filtered = useMemo(() => filterOrders(orders, { search, product: productFilter, fulfillment: wlFilter, sort }), [orders, search, productFilter, wlFilter, sort])
  const result = getListPage(filtered, page, pageSize)
  const hasFilters = !!search || productFilter !== "all" || wlFilter !== "all"
  const resetFilters = () => { setSearch(""); setProductFilter("all"); setWlFilter("all"); setPage(1) }

  const recordRefund = async (id: string) => {
    if (!confirm(t("record_refund_confirm"))) return
    await updateOrder(id, { status: "refunded" })
  }

  const updateOrder = async (id: string, body: { status?: string; whitelist_status?: string }) => {
    if (session?.user?.role !== "admin") return
    setUpdating(id)
    setNotice(null)
    try {
      const response = await fetch(`/api/admin/orders/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      if (!response.ok) {
        setNotice({ error: true, text: body.status === "refunded" ? t("refund_record_failed") : (isTH ? "เปลี่ยนสถานะส่งมอบไม่สำเร็จ กรุณาลองอีกครั้ง" : "Could not update delivery status. Please try again.") })
        return
      }
      setNotice({ error: false, text: isTH ? "บันทึกสถานะคำสั่งซื้อแล้ว" : "Order status saved." })
      router.refresh()
    } catch {
      setNotice({ error: true, text: isTH ? "เชื่อมต่อไม่สำเร็จ กรุณาตรวจสอบสถานะแล้วลองอีกครั้ง" : "Connection failed. Please check the current status and try again." })
    } finally { setUpdating(null) }
  }
  const handleWhitelistStatus = (id: string, whitelist_status: string) => updateOrder(id, { whitelist_status })

  const pendingWl = orders.filter(
    (o) => o.status === "paid" && (!o.whitelist_status || o.whitelist_status === "pending")
  ).length

  return (
    <div className="min-w-0 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-bold">{t("orders")}</h1>
          <p className="text-text-muted text-[13px] mt-1">{isTH ? "รายการชำระเงินแล้ว · ไม่รวมรายการทดลอง" : "Paid orders · excludes trials"}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {pendingWl > 0 && (
            <button onClick={() => { setWlFilter("pending"); setPage(1) }} className="rounded-lg border border-orange-500/25 bg-orange-500/10 px-3 py-2.5 text-[13px] text-[var(--color-stock-low)] focus-visible:outline-2 focus-visible:outline-accent">
              {isTH ? `รอส่งมอบ ${pendingWl} รายการ` : `${pendingWl} awaiting delivery`}
            </button>
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
        onCreated={() => router.refresh()}
      />

      {notice && <div role={notice.error ? "alert" : "status"} className={`rounded-lg border p-3 text-[13px] ${notice.error ? "border-red-500/30 bg-red-500/10 text-hot" : "border-success/30 bg-[var(--color-success-bg)] text-success"}`}>{notice.text}</div>}

      <div className="rounded-xl border border-border-soft bg-bg-card p-4">
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_minmax(180px,240px)_160px_150px]">
          <label className="min-w-0 space-y-1.5 text-[12px] text-text-muted"><span>{isTH ? "ค้นหาคำสั่งซื้อ" : "Search orders"}</span>
            <input type="search" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder={isTH ? "ลูกค้า อีเมล เกม หรือเลขคำสั่งซื้อ" : "Customer, email, game or order ID"} className={control} />
          </label>
          <label className="min-w-0 space-y-1.5 text-[12px] text-text-muted"><span>{t("product")}</span>
            <select value={productFilter} onChange={e => { setProductFilter(e.target.value); setPage(1) }} className={control}>
              <option value="all">{isTH ? "สินค้าทั้งหมด" : "All products"} ({orders.length})</option>
              {productOptions.map(product => <option key={product.id} value={product.id}>{productName(product, locale)} ({product.count})</option>)}
            </select>
          </label>
          <label className="min-w-0 space-y-1.5 text-[12px] text-text-muted"><span>{isTH ? "สถานะส่งมอบสิทธิ์" : "Access delivery"}</span>
            <select value={wlFilter} onChange={e => { setWlFilter(e.target.value); setPage(1) }} className={control}>
              <option value="all">{isTH ? "ทุกสถานะส่งมอบ" : "All delivery statuses"}</option>
              {DELIVERY_STATUSES.map(status => <option key={status} value={status}>{deliveryStatusLabel(status, locale)}</option>)}
            </select>
          </label>
          <label className="min-w-0 space-y-1.5 text-[12px] text-text-muted"><span>{isTH ? "เรียงตาม" : "Sort by"}</span>
            <select value={sort} onChange={e => { setSort(e.target.value as OrderFilters["sort"]); setPage(1) }} className={control}>
              <option value="newest">{isTH ? "ใหม่ล่าสุด" : "Newest first"}</option>
              <option value="oldest">{isTH ? "เก่าที่สุด" : "Oldest first"}</option>
            </select>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[12px]">
          <p role="status" className="text-text-muted">{isTH ? `พบ ${filtered.length.toLocaleString()} จาก ${orders.length.toLocaleString()} รายการที่ชำระเงินแล้ว` : `${filtered.length.toLocaleString()} of ${orders.length.toLocaleString()} paid orders`}</p>
          {hasFilters && <button onClick={resetFilters} className="rounded text-accent-light underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-accent">{isTH ? "ล้างตัวกรอง" : "Reset filters"}</button>}
        </div>
      </div>

      {/* Table */}
      <div className="min-w-0 overflow-hidden rounded-xl border border-border-soft bg-bg-card">
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={isTH ? "ตารางคำสั่งซื้อ เลื่อนแนวนอนเพื่อดูข้อมูลทั้งหมด" : "Orders table. Scroll horizontally for all columns."}>
          <table className="w-full min-w-[1100px] text-[13px]">
            <thead>
              <tr className="border-b border-border-soft bg-bg-card-hover text-left text-[12px] text-text-muted">
                <th className="px-5 py-3.5 font-medium">{t("user")}</th>
                <th className="px-4 py-3.5 font-medium">{t("product")}</th>
                <th className="px-4 py-3.5 font-medium">{t("in_game_username")}</th>
                <th className="px-4 py-3.5 font-medium">{t("amount")}</th>
                <th className="px-4 py-3.5 font-medium">{isTH ? "ช่องทางชำระเงิน" : "Payment method"}</th>
                <th className="px-4 py-3.5 font-medium">{isTH ? "สถานะชำระเงิน" : "Payment status"}</th>
                <th className="px-4 py-3.5 font-medium">{isTH ? "สถานะส่งมอบสิทธิ์" : "Access delivery"}</th>
                <th className="px-4 py-3.5 font-medium">{t("date")}</th>
                <th className="px-4 py-3.5 font-medium">{t("actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-soft">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-text-muted">
                    <p>{t("no_orders")}</p>
                    {hasFilters && <button onClick={resetFilters} className="mt-3 text-accent-light underline underline-offset-4">{isTH ? "ล้างตัวกรองเพื่อดูคำสั่งซื้อทั้งหมด" : "Reset filters to see all orders"}</button>}
                  </td>
                </tr>
              )}
              {result.items.map((o) => (
                <tr key={o.id} className="hover:bg-bg-card-hover transition">
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
                          <img src={o.users.avatar} alt="" className="w-6 h-6 rounded-full object-cover" />
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
                    <p className="max-w-[220px] break-words text-text-base">{o.products ? productName(o.products, locale) : "—"}</p>
                    <p className="text-[11px] text-text-muted">{(locale === "th" ? o.product_variants?.label_th || o.product_variants?.label_en : o.product_variants?.label_en || o.product_variants?.label_th) || ""}</p>
                    <p className="mt-1 text-[10px] text-text-muted" title={o.id}>#{o.id.slice(0, 8)}</p>
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
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${o.status === "paid" ? "bg-[var(--color-success-bg)] text-success" :
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
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${o.whitelist_status === "whitelisted" ? "bg-[var(--color-success-bg)] text-success" :
                          ["removed", "revoked"].includes(o.whitelist_status || "") ? "bg-red-500/15 text-hot" :
                          o.whitelist_status === "expired" ? "bg-[var(--color-surface-tint)] text-text-muted" :
                            "bg-orange-500/10 text-[var(--color-stock-low)]"
                        }`}>
                        {deliveryStatusLabel(o.whitelist_status, locale)}
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
                        {session?.user?.role === "admin" && o.products?.type === "roblox_whitelist" && <button onClick={() => void recordRefund(o.id)} disabled={updating !== null} className="text-[11px] px-3 py-1.5 rounded-lg text-hot border border-red-400/20 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-accent">{t("record_refund")}</button>}
                        {(!o.whitelist_status || o.whitelist_status === "pending") && session?.user?.role === "admin" && (
                          <button
                            onClick={() => handleWhitelistStatus(o.id, "whitelisted")}
                            disabled={updating !== null}
                            className="text-[11px] px-3 py-1.5 rounded-lg bg-[var(--color-success-bg)] text-success hover:opacity-80 transition disabled:opacity-40 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-accent"
                          >
                            {updating === o.id ? "..." : t("mark_whitelisted")}
                          </button>
                        )}
                        {o.whitelist_status === "whitelisted" && session?.user?.role === "admin" && (
                          <button
                            onClick={() => handleWhitelistStatus(o.id, "removed")}
                            disabled={updating !== null}
                            className="text-[11px] px-3 py-1.5 rounded-lg bg-red-500/15 text-hot hover:opacity-80 transition disabled:opacity-40 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-accent"
                          >
                            {updating === o.id ? "..." : t("remove")}
                          </button>
                        )}
                        {o.whitelist_status === "removed" && session?.user?.role === "admin" && (
                          <button
                            onClick={() => handleWhitelistStatus(o.id, "whitelisted")}
                            disabled={updating !== null}
                            className="text-[11px] px-3 py-1.5 rounded-lg bg-[var(--color-success-bg)] text-success hover:opacity-80 transition disabled:opacity-40 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-accent"
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
        <nav aria-label={isTH ? "หน้ารายการคำสั่งซื้อ" : "Order pages"} className="flex flex-wrap items-center justify-between gap-3 border-t border-border-soft px-4 py-3 text-[12px] text-text-muted">
          <div className="flex flex-wrap items-center gap-3"><span>{result.start}–{result.end} / {filtered.length}</span><label className="flex items-center gap-2">{isTH ? "ต่อหน้า" : "Per page"}<select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }} className="rounded-md border border-border-soft bg-bg-input px-2 py-1.5 text-text-base focus-visible:outline-2 focus-visible:outline-accent">{[10, 25, 50].map(size => <option key={size} value={size}>{size}</option>)}</select></label></div>
          <div className="flex items-center gap-3"><button className={quietButton} disabled={result.page === 1} onClick={() => setPage(result.page - 1)}>{isTH ? "ก่อนหน้า" : "Previous"}</button><span>{isTH ? "หน้า" : "Page"} {result.page} / {result.pageCount}</span><button className={quietButton} disabled={result.page === result.pageCount} onClick={() => setPage(result.page + 1)}>{isTH ? "ถัดไป" : "Next"}</button></div>
        </nav>
      </div>
    </div>
  )
}
