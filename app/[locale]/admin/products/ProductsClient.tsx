"use client"

import { useState, useMemo } from "react"
import { Link, useRouter } from "@/i18n/routing"

function StatusDot({ active }: { active: boolean }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${active ? "bg-green-400" : "bg-white/20"}`} />
  )
}

export default function ProductsClient({ products }: { products: any[] }) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<"all" | "active" | "inactive" | "featured">("all")
  const [deleting, setDeleting] = useState<string | null>(null)

  const filtered = useMemo(() => {
    return products
      .filter((p) => {
        if (filter === "active")   return p.is_active
        if (filter === "inactive") return !p.is_active
        if (filter === "featured") return p.is_featured
        return true
      })
      .filter((p) =>
        p.name_en.toLowerCase().includes(search.toLowerCase()) ||
        p.slug.toLowerCase().includes(search.toLowerCase())
      )
  }, [products, search, filter])

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this product? This will also remove all keys and variants.")) return
    setDeleting(id)
    await fetch(`/api/admin/products/${id}`, { method: "DELETE" })
    router.refresh()
    setDeleting(null)
  }

  const handleToggleActive = async (id: string, current: boolean) => {
    await fetch(`/api/admin/products/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !current }),
    })
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-bold">Products</h1>
          <p className="text-text-muted text-[13px] mt-0.5">{products.length} total</p>
        </div>
        <Link href="/admin/products/new"
          className="bg-accent hover:opacity-90 text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl transition active:scale-95">
          + New Product
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products..."
          className="flex-1 min-w-[200px] bg-bg-card border border-accent/15 rounded-xl px-4 py-2.5 text-[13px] placeholder:text-text-muted outline-none focus:border-accent/40"
        />
        <div className="flex gap-1 bg-bg-card border border-accent/15 rounded-xl p-1">
          {(["all", "active", "inactive", "featured"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition capitalize ${
                filter === f ? "bg-accent/20 text-accent-light" : "text-text-muted hover:text-text-base"
              }`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-bg-card border border-accent/10 rounded-2xl overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-[11px] text-text-muted border-b border-white/5 bg-white/[0.02]">
              <th className="px-5 py-3.5 font-medium">Product</th>
              <th className="px-4 py-3.5 font-medium">Variants</th>
              <th className="px-4 py-3.5 font-medium">Stock</th>
              <th className="px-4 py-3.5 font-medium">Orders</th>
              <th className="px-4 py-3.5 font-medium">Status</th>
              <th className="px-4 py-3.5 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-12 text-text-muted">No products found</td>
              </tr>
            )}
            {filtered.map((p) => {
              const totalStock = p.product_variants.reduce((s: number, v: any) => s + v.stock, 0)
              return (
                <tr key={p.id} className="hover:bg-white/[0.02] transition">
                  {/* Product */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={p.product_images?.[0]?.url || "/placeholder.png"}
                        className="w-10 h-10 rounded-lg object-cover bg-bg-base"
                      />
                      <div>
                        <p className="font-medium line-clamp-1">{p.name_en}</p>
                        <p className="text-[11px] text-text-muted mt-0.5">{p.slug}</p>
                      </div>
                    </div>
                  </td>

                  {/* Variants */}
                  <td className="px-4 py-4">
                    <div className="space-y-0.5">
                      {p.product_variants.map((v: any) => (
                        <div key={v.id} className="flex items-center gap-2 text-[12px]">
                          <span className="text-text-muted">{v.label_en}</span>
                          <span className="text-accent-light font-medium">฿{v.price}</span>
                        </div>
                      ))}
                    </div>
                  </td>

                  {/* Stock */}
                  <td className="px-4 py-4">
                    <span className={`text-[12px] font-medium ${
                      totalStock === 0 ? "text-red-400"
                      : p.isLower ? "text-orange-400"
                      : "text-green-400"
                    }`}>
                      {totalStock === 0 ? "Out of stock" : `${totalStock} keys`}
                    </span>
                  </td>

                  {/* Orders */}
                  <td className="px-4 py-4 text-text-muted">
                    {p._count.orders}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-4">
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => handleToggleActive(p.id, p.is_active)}
                        className="flex items-center gap-1.5 text-[12px] hover:opacity-70 transition"
                      >
                        <StatusDot active={p.is_active} />
                        <span className={p.is_active ? "text-green-400" : "text-text-muted"}>
                          {p.is_active ? "Active" : "Inactive"}
                        </span>
                      </button>
                      {p.is_featured && (
                        <span className="text-[10px] text-yellow-400">★ Featured</span>
                      )}
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <Link href={`/admin/products/${p.id}`}
                        className="text-[12px] px-3 py-1.5 rounded-lg border border-accent/20 text-accent-light hover:bg-accent/10 transition">
                        Edit
                      </Link>
                      <button
                        onClick={() => handleDelete(p.id)}
                        disabled={deleting === p.id}
                        className="text-[12px] px-3 py-1.5 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 transition disabled:opacity-40">
                        {deleting === p.id ? "..." : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}