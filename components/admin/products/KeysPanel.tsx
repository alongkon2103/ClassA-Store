"use client"

import { useState, useEffect } from "react"

type Variant = { id: string; label_en: string; price: number | string }
type GameKey = {
  id: string
  status: string
  variant_id: string | null
  key_value: string
  created_at: string | Date
}

export default function KeysPanel({ productId, variants }: { productId: string; variants: Variant[] }) {
  const [keys, setKeys]         = useState<GameKey[]>([])
  const [loading, setLoading]   = useState(true)
  const [bulk, setBulk]         = useState("")
  const [variantId, setVariantId] = useState(variants[0]?.id ?? "")
  const [saving, setSaving]     = useState(false)
  const [filter, setFilter]     = useState<"all" | "available" | "assigned">("all")

  useEffect(() => {
    fetch(`/api/admin/products/${productId}/keys`)
      .then((r) => r.json())
      .then((d) => { setKeys(d); setLoading(false) })
  }, [productId])

  const handleBulkAdd = async () => {
    const lines = bulk.split("\n").map((l) => l.trim()).filter(Boolean)
    if (!lines.length) return
    setSaving(true)
    const res = await fetch(`/api/admin/products/${productId}/keys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keys: lines, variant_id: variantId }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { alert(data.error); return }
    setKeys((k) => [...data, ...k])
    setBulk("")
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/admin/products/${productId}/keys/${id}`, { method: "DELETE" })
    setKeys((k) => k.filter((key) => key.id !== id))
  }

  const filtered = keys.filter((k) => filter === "all" || k.status === filter)
  const availableCount = keys.filter((k) => k.status === "available").length

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="flex gap-3">
        {[
          { label: "Total",     value: keys.length,      color: "text-text-base" },
          { label: "Available", value: availableCount,   color: "text-green-400" },
          { label: "Assigned",  value: keys.length - availableCount, color: "text-text-muted" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-bg-base border border-accent/10 rounded-xl px-4 py-3 text-center min-w-[90px]">
            <p className={`text-[20px] font-bold ${color}`}>{value}</p>
            <p className="text-[11px] text-text-muted">{label}</p>
          </div>
        ))}
      </div>

      {/* Bulk Add */}
      <div className="bg-bg-base border border-accent/15 rounded-2xl p-4 space-y-3">
        <p className="text-[13px] font-medium">Bulk Add Keys</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] text-text-muted uppercase mb-1.5">Variant</label>
            <select value={variantId} onChange={(e) => setVariantId(e.target.value)} className={inp}>
              {variants.map((v) => (
                <option key={v.id} value={v.id}>{v.label_en} — ฿{v.price}</option>
              ))}
            </select>
          </div>
        </div>
        <textarea
          value={bulk}
          onChange={(e) => setBulk(e.target.value)}
          rows={5}
          placeholder={"KEY-AAAA-1111\nKEY-BBBB-2222\nKEY-CCCC-3333\n(one key per line)"}
          className={`${inp} resize-none font-mono`}
        />
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-text-muted">
            {bulk.split("\n").filter((l) => l.trim()).length} keys to import
          </span>
          <button onClick={handleBulkAdd} disabled={saving || !bulk.trim()}
            className="px-5 py-2 rounded-xl bg-accent text-white text-[13px] font-medium hover:opacity-90 transition disabled:opacity-40">
            {saving ? "Importing..." : "Import Keys"}
          </button>
        </div>
      </div>

      {/* Filter + Table */}
      <div className="flex gap-1 bg-bg-card border border-accent/10 rounded-xl p-1 w-fit">
        {(["all", "available", "assigned"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition capitalize ${
              filter === f ? "bg-accent/20 text-accent-light" : "text-text-muted hover:text-text-base"
            }`}>
            {f} {f === "all" ? `(${keys.length})` : f === "available" ? `(${availableCount})` : `(${keys.length - availableCount})`}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-text-muted text-[13px] py-4">Loading...</p>
      ) : (
        <div className="bg-bg-card border border-accent/10 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-[13px] min-w-[600px]">
            <thead>
              <tr className="text-left text-[11px] text-text-muted border-b border-white/5 bg-white/[0.02]">
                <th className="px-4 py-3 font-medium">Key</th>
                <th className="px-4 py-3 font-medium">Variant</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="text-center py-8 text-text-muted">No keys</td></tr>
              )}
              {filtered.map((k) => (
                <tr key={k.id} className="hover:bg-white/[0.02] transition">
                  <td className="px-4 py-3 font-mono text-[12px]">{k.key_value}</td>
                  <td className="px-4 py-3 text-text-muted">
                    {variants.find((v) => v.id === k.variant_id)?.label_en ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                      k.status === "available"
                        ? "bg-green-500/15 text-green-400"
                        : "bg-white/5 text-text-muted"
                    }`}>
                      {k.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-muted">
                    {new Date(k.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {k.status === "available" && (
                      <button onClick={() => handleDelete(k.id)}
                        className="text-[12px] px-2.5 py-1 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 transition">
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  )
}

const inp = "w-full bg-bg-card border border-accent/15 rounded-xl px-3 py-2.5 text-[13px] placeholder:text-text-muted outline-none focus:border-accent/40 transition"