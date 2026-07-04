"use client"

import { useState, useMemo } from "react"
import { useRouter } from "@/i18n/routing"
import { format } from "date-fns"

import { useTranslations, useLocale } from "next-intl"

type KeyRow = {
  id: string
  key_value: string
  status: string
  product_id: string
  created_at: Date | null
  products: { name_th?: string | null; name_en?: string | null } | null
  product_variants: { label_th?: string | null; label_en?: string | null } | null
  orders: { users: { username: string | null } | null } | null
}

type ProductVariant = {
  id: string
  label_th?: string | null
  label_en: string
  price: number
}

type ProductRow = {
  id: string
  name_th: string
  name_en: string
  product_variants: ProductVariant[]
}

export default function KeysClient({ keys, products }: { keys: KeyRow[]; products: ProductRow[] }) {
  const t = useTranslations("AdminKeys")
  const locale = useLocale()
  const router = useRouter()

  // ── filters ──
  const [search,    setSearch]    = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "available" | "assigned">("all")
  const [productFilter, setProductFilter] = useState("all")

  // ── bulk add ──
  const [showBulk,   setShowBulk]   = useState(false)
  const [bulkText,   setBulkText]   = useState("")
  const [bulkProduct, setBulkProduct] = useState(products[0]?.id ?? "")
  const [bulkVariant, setBulkVariant] = useState(products[0]?.product_variants?.[0]?.id ?? "")
  const [saving,     setSaving]     = useState(false)

  const [deletingId, setDeletingId] = useState<string | null>(null)

  // ── derived ──
  const availableVariants = useMemo(
    () => products.find((p) => p.id === bulkProduct)?.product_variants ?? [],
    [products, bulkProduct]
  )

  const filtered = useMemo(() => {
    return keys
      .filter((k) => statusFilter  === "all" || k.status === statusFilter)
      .filter((k) => productFilter === "all" || k.product_id === productFilter)
      .filter((k) => {
        const q = search.toLowerCase()
        const productName = (locale === "th" ? k.products?.name_th : k.products?.name_en) || ""
        return (
          k.key_value.toLowerCase().includes(q) ||
          productName.toLowerCase().includes(q) ||
          (k.orders?.users?.username ?? "").toLowerCase().includes(q)
        )
      })
  }, [keys, statusFilter, productFilter, search, locale])

  const stats = useMemo(() => ({
    total:    keys.length,
    available: keys.filter((k) => k.status === "available").length,
    assigned:  keys.filter((k) => k.status === "assigned").length,
  }), [keys])

  // ── handlers ──
  const handleProductChange = (pid: string) => {
    setBulkProduct(pid)
    const firstVariant = products.find((p) => p.id === pid)?.product_variants?.[0]?.id ?? ""
    setBulkVariant(firstVariant)
  }

  const handleBulkAdd = async () => {
    const lines = bulkText.split("\n").map((l) => l.trim()).filter(Boolean)
    if (!lines.length)    { alert(t("no_keys_alert")); return }
    if (!bulkVariant)     { alert(t("select_variant")); return }
    setSaving(true)

    const res = await fetch(`/api/admin/products/${bulkProduct}/keys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keys: lines, variant_id: bulkVariant }),
    })
    const data = await res.json()
    setSaving(false)

    if (!res.ok) { alert(data.error ?? "Error"); return }
    setBulkText("")
    setShowBulk(false)
    router.refresh()
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t("delete_confirm"))) return
    setDeletingId(id)
    const key = keys.find((k) => k.id === id)
    await fetch(`/api/admin/products/${key!.product_id}/keys/${id}`, { method: "DELETE" })
    setDeletingId(null)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-bold">{t("title")}</h1>
          <p className="text-text-muted text-[13px] mt-0.5">{t("total_keys", { count: keys.length })}</p>
        </div>
        <button onClick={() => setShowBulk(true)}
          className="bg-accent hover:opacity-90 text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl transition active:scale-95">
          + {t("bulk_import")}
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { key: "total",     value: stats.total,     color: "text-text-base" },
          { key: "available", value: stats.available, color: "text-green-400" },
          { key: "assigned",  value: stats.assigned,  color: "text-text-muted" },
        ].map(({ key, value, color }) => (
          <div key={key} className="bg-bg-card border border-accent/10 rounded-2xl p-4 text-center">
            <p className={`text-[28px] font-bold ${color}`}>{value}</p>
            <p className="text-[11px] text-text-muted mt-1">{t(key)}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("search_placeholder")}
          className="flex-1 min-w-[200px] bg-bg-card border border-accent/15 rounded-xl px-4 py-2.5 text-[13px] placeholder:text-text-muted outline-none focus:border-accent/40"
        />

        {/* Status filter */}
        <div className="flex gap-1 bg-bg-card border border-accent/15 rounded-xl p-1">
          {(["all", "available", "assigned"] as const).map((f) => (
            <button key={f} onClick={() => setStatusFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition capitalize ${
                statusFilter === f ? "bg-accent/20 text-accent-light" : "text-text-muted hover:text-text-base"
              }`}>
              {f === "all" ? t("total") : t(f)}
            </button>
          ))}
        </div>

        {/* Product filter */}
        <select value={productFilter} onChange={(e) => setProductFilter(e.target.value)}
          className="bg-bg-card border border-accent/15 rounded-xl px-3 py-2.5 text-[13px] text-text-base outline-none focus:border-accent/40">
          <option value="all">{t("all_products")}</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{locale === "th" ? p.name_th : p.name_en}</option>
          ))}
        </select>
      </div>

      {/* Bulk Import Modal */}
      {showBulk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(4,10,18,.85)", backdropFilter: "blur(8px)" }}
          onClick={() => setShowBulk(false)}>
          <div className="bg-bg-card border border-accent/20 rounded-2xl p-6 w-full max-w-lg space-y-4"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="text-[16px] font-bold">{t("bulk_import_title")}</p>
              <button onClick={() => setShowBulk(false)} className="text-text-muted hover:text-text-base">✕</button>
            </div>

            {/* Product */}
            <div>
              <label className={lbl}>{t("product")}</label>
              <select value={bulkProduct} onChange={(e) => handleProductChange(e.target.value)} className={inp}>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{locale === "th" ? p.name_th : p.name_en}</option>
                ))}
              </select>
            </div>

            {/* Variant */}
            <div>
              <label className={lbl}>{t("variant")}</label>
              <select value={bulkVariant} onChange={(e) => setBulkVariant(e.target.value)} className={inp}>
                {availableVariants.map((v) => (
                  <option key={v.id} value={v.id}>{(locale === "th" ? v.label_th : v.label_en) || "Standard"} — ฿{Number(v.price).toLocaleString()}</option>
                ))}
              </select>
            </div>

            {/* Keys textarea */}
            <div>
              <label className={lbl}>{t("textarea_label")}</label>
              <textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                rows={8}
                placeholder={t("textarea_placeholder")}
                className={`${inp} resize-none font-mono text-[12px]`}
              />
              <p className="text-[11px] text-text-muted mt-1">
                {t("keys_to_import", { count: bulkText.split("\n").filter((l) => l.trim()).length })}
              </p>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setShowBulk(false)}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-text-muted text-[13px] hover:text-text-base transition">
                {t("cancel")}
              </button>
              <button onClick={handleBulkAdd} disabled={saving || !bulkText.trim()}
                className="flex-1 py-2.5 rounded-xl bg-accent text-white text-[13px] font-semibold hover:opacity-90 transition disabled:opacity-40">
                {saving ? t("importing") : t("import_keys")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-bg-card border border-accent/10 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-white/5 text-[12px] text-text-muted">
          Showing {filtered.length} of {keys.length} keys
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] text-text-muted border-b border-white/5 bg-white/[0.02]">
                <th className="px-5 py-3.5 font-medium">{t("key")}</th>
                <th className="px-4 py-3.5 font-medium">{t("product")}</th>
                <th className="px-4 py-3.5 font-medium">{t("variant")}</th>
                <th className="px-4 py-3.5 font-medium">{t("status")}</th>
                <th className="px-4 py-3.5 font-medium">{t("assigned_to")}</th>
                <th className="px-4 py-3.5 font-medium">{t("created")}</th>
                <th className="px-4 py-3.5 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-text-muted">{t("no_keys")}</td>
                </tr>
              )}
              {filtered.map((k) => (
                <tr key={k.id} className="hover:bg-white/[0.02] transition">
                  {/* Key */}
                  <td className="px-5 py-3.5">
                    <span className="font-mono text-[12px] bg-bg-base px-2 py-1 rounded-lg">
                      {k.key_value}
                    </span>
                  </td>

                  {/* Product */}
                  <td className="px-4 py-3.5 text-text-muted">
                    {locale === "th" ? k.products?.name_th : k.products?.name_en ?? "—"}
                  </td>

                  {/* Variant */}
                  <td className="px-4 py-3.5 text-text-muted">
                    {locale === "th" ? k.product_variants?.label_th : k.product_variants?.label_en ?? "—"}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3.5">
                    <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${
                      k.status === "available"
                        ? "bg-green-500/15 text-green-400"
                        : "bg-white/5 text-text-muted"
                    }`}>
                      {t(k.status)}
                    </span>
                  </td>

                  {/* Assigned To */}
                  <td className="px-4 py-3.5 text-text-muted text-[12px]">
                    {k.orders?.users?.username ?? "—"}
                  </td>

                  {/* Created */}
                  <td className="px-4 py-3.5 text-text-muted whitespace-nowrap">
                    {k.created_at ? format(new Date(k.created_at), "dd MMM yyyy") : "—"}
                  </td>

                  {/* Delete */}
                  <td className="px-4 py-3.5">
                    {k.status === "available" && (
                      <button
                        onClick={() => handleDelete(k.id)}
                        disabled={deletingId === k.id}
                        className="text-[12px] px-2.5 py-1 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 transition disabled:opacity-40">
                        {deletingId === k.id ? "..." : t("delete")}
                      </button>
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

const lbl = "block text-[11px] text-text-muted uppercase tracking-wide mb-1.5"
const inp = "w-full bg-bg-base border border-accent/15 rounded-xl px-3 py-2.5 text-[13px] placeholder:text-text-muted outline-none focus:border-accent/40 transition"
