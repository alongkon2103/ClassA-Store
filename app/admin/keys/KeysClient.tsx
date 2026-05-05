"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"

export default function KeysClient({ keys, products }: { keys: any[]; products: any[] }) {
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
      .filter((k) =>
        k.key_value.toLowerCase().includes(search.toLowerCase()) ||
        k.products?.name_en.toLowerCase().includes(search.toLowerCase()) ||
        (k.orders?.users?.username ?? "").toLowerCase().includes(search.toLowerCase())
      )
  }, [keys, statusFilter, productFilter, search])

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
    if (!lines.length)    { alert("No keys entered"); return }
    if (!bulkVariant)     { alert("Select a variant"); return }
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
    if (!confirm("Delete this key?")) return
    setDeletingId(id)
    const key = keys.find((k) => k.id === id)
    await fetch(`/api/admin/products/${key.product_id}/keys/${id}`, { method: "DELETE" })
    setDeletingId(null)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-bold">Game Keys</h1>
          <p className="text-text-muted text-[13px] mt-0.5">{keys.length} total keys</p>
        </div>
        <button onClick={() => setShowBulk(true)}
          className="bg-accent hover:opacity-90 text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl transition active:scale-95">
          + Bulk Import
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total",     value: stats.total,     color: "text-text-base" },
          { label: "Available", value: stats.available, color: "text-green-400" },
          { label: "Assigned",  value: stats.assigned,  color: "text-text-muted" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-bg-card border border-accent/10 rounded-2xl p-4 text-center">
            <p className={`text-[28px] font-bold ${color}`}>{value}</p>
            <p className="text-[11px] text-text-muted mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search key, product, user..."
          className="flex-1 min-w-[200px] bg-bg-card border border-accent/15 rounded-xl px-4 py-2.5 text-[13px] placeholder:text-text-muted outline-none focus:border-accent/40"
        />

        {/* Status filter */}
        <div className="flex gap-1 bg-bg-card border border-accent/15 rounded-xl p-1">
          {(["all", "available", "assigned"] as const).map((f) => (
            <button key={f} onClick={() => setStatusFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition capitalize ${
                statusFilter === f ? "bg-accent/20 text-accent-light" : "text-text-muted hover:text-text-base"
              }`}>
              {f}
            </button>
          ))}
        </div>

        {/* Product filter */}
        <select value={productFilter} onChange={(e) => setProductFilter(e.target.value)}
          className="bg-bg-card border border-accent/15 rounded-xl px-3 py-2.5 text-[13px] text-text-base outline-none focus:border-accent/40">
          <option value="all">All Products</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.name_en}</option>
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
              <p className="text-[16px] font-bold">Bulk Import Keys</p>
              <button onClick={() => setShowBulk(false)} className="text-text-muted hover:text-text-base">✕</button>
            </div>

            {/* Product */}
            <div>
              <label className={lbl}>Product</label>
              <select value={bulkProduct} onChange={(e) => handleProductChange(e.target.value)} className={inp}>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name_en}</option>
                ))}
              </select>
            </div>

            {/* Variant */}
            <div>
              <label className={lbl}>Variant</label>
              <select value={bulkVariant} onChange={(e) => setBulkVariant(e.target.value)} className={inp}>
                {availableVariants.map((v: any) => (
                  <option key={v.id} value={v.id}>{v.label_en} — ฿{Number(v.price).toLocaleString()}</option>
                ))}
              </select>
            </div>

            {/* Keys textarea */}
            <div>
              <label className={lbl}>Keys (one per line)</label>
              <textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                rows={8}
                placeholder={"KEY-AAAA-1111\nKEY-BBBB-2222\nKEY-CCCC-3333"}
                className={`${inp} resize-none font-mono text-[12px]`}
              />
              <p className="text-[11px] text-text-muted mt-1">
                {bulkText.split("\n").filter((l) => l.trim()).length} keys to import
              </p>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setShowBulk(false)}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-text-muted text-[13px] hover:text-text-base transition">
                Cancel
              </button>
              <button onClick={handleBulkAdd} disabled={saving || !bulkText.trim()}
                className="flex-1 py-2.5 rounded-xl bg-accent text-white text-[13px] font-semibold hover:opacity-90 transition disabled:opacity-40">
                {saving ? "Importing..." : "Import Keys"}
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
                <th className="px-5 py-3.5 font-medium">Key</th>
                <th className="px-4 py-3.5 font-medium">Product</th>
                <th className="px-4 py-3.5 font-medium">Variant</th>
                <th className="px-4 py-3.5 font-medium">Status</th>
                <th className="px-4 py-3.5 font-medium">Assigned To</th>
                <th className="px-4 py-3.5 font-medium">Created</th>
                <th className="px-4 py-3.5 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-text-muted">No keys found</td>
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
                    {k.products?.name_en ?? "—"}
                  </td>

                  {/* Variant */}
                  <td className="px-4 py-3.5 text-text-muted">
                    {k.product_variants?.label_en ?? "—"}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3.5">
                    <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${
                      k.status === "available"
                        ? "bg-green-500/15 text-green-400"
                        : "bg-white/5 text-text-muted"
                    }`}>
                      {k.status}
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
                        {deletingId === k.id ? "..." : "Delete"}
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