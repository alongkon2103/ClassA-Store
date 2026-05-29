"use client"

import { useState, useMemo } from "react"
import { Link, useRouter } from "@/i18n/routing"
import { useTranslations, useLocale } from "next-intl"
import { useSession } from "next-auth/react"
import { getImageUrl } from "@/lib/getImageUrl"

function StatusDot({ active }: { active: boolean }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${active ? "bg-green-400" : "bg-white/20"}`} />
  )
}

export default function ProductsClient({ products }: { products: any[] }) {
  const router = useRouter()
  const t = useTranslations("Admin")
  const locale = useLocale()
  const { data: session } = useSession()

  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<"all" | "active" | "inactive" | "featured">("all")
  const [deleting, setDeleting] = useState<string | null>(null)

  const filtered = useMemo(() => {
    return products
      .filter((p) => {
        if (filter === "active") return p.is_active
        if (filter === "inactive") return !p.is_active
        if (filter === "featured") return p.is_featured
        return true
      })
      .filter((p) => {
        const name = (locale === "th" ? p.name_th : p.name_en) || ""
        return (
          name.toLowerCase().includes(search.toLowerCase()) ||
          p.slug.toLowerCase().includes(search.toLowerCase())
        )
      })
  }, [products, search, filter, locale])

  const handleDelete = async (id: string) => {
    if (!confirm(t("delete_product_confirm"))) return
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
          <h1 className="text-[24px] font-bold">{t("products")}</h1>
          <p className="text-text-muted text-[13px] mt-0.5">{products.length} {t("total")}</p>
        </div>
        <Link href="/admin/products/new"
          className="bg-accent hover:opacity-90 text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl transition active:scale-95">
          + {t("new_product")}
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("search_placeholder")}
          className="flex-1 min-w-[200px] bg-bg-card border border-accent/15 rounded-xl px-4 py-2.5 text-[13px] placeholder:text-text-muted outline-none focus:border-accent/40"
        />
        <div className="flex gap-1 bg-bg-card border border-accent/15 rounded-xl p-1">
          {(["all", "active", "inactive", "featured"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition capitalize ${filter === f ? "bg-accent/20 text-accent-light" : "text-text-muted hover:text-text-base"
                }`}>
              {t(f)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-bg-card border border-accent/10 rounded-2xl overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-[11px] text-text-muted border-b border-white/5 bg-white/[0.02]">
              <th className="px-5 py-3.5 font-medium">{t("product")}</th>
              <th className="px-4 py-3.5 font-medium">Variants & Prices</th>
              <th className="px-4 py-3.5 font-medium">Orders</th>
              <th className="px-4 py-3.5 font-medium">{t("status")}</th>
              <th className="px-4 py-3.5 font-medium">{t("actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-12 text-text-muted">{t("no_products_found")}</td>
              </tr>
            )}
            {filtered.map((p) => {
              const name = locale === "th" ? p.name_th : p.name_en
              return (
                <tr key={p.id} className="hover:bg-white/[0.02] transition">
                  {/* Product */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={getImageUrl(p.product_images?.[0]?.url || "/placeholder.png")}
                        className="w-10 h-10 rounded-lg object-cover bg-bg-base"
                      />
                      <div>
                        <p className="font-medium line-clamp-1">{name}</p>
                        <p className="text-[11px] text-text-muted mt-0.5">{p.slug}</p>
                      </div>
                    </div>
                  </td>

                  {/* Variants (Added Premium Labels) */}
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {p.product_variants.map((v: any) => (
                        <div
                          key={v.id}
                          className="flex items-center gap-1.5 text-[12px]"
                        >
                          <span className="text-text-muted whitespace-nowrap">
                            {locale === "th" ? v.label_th : v.label_en}
                          </span>

                          {/* แสดงราคาเฉพาะ variant ที่ไม่ใช่ premium */}
                          {v.variant_type !== "premium" && (
                            <span className="text-accent-light font-medium">
                              ฿{v.price}
                            </span>
                          )}

                          {/* Premium Indicator */}
                          {v.variant_type === "premium" && (
                            <span className="text-[9px] px-1 bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 rounded font-bold">
                              PREMIUM
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </td>

                  {/* Orders */}
                  <td className="px-4 py-4 text-text-muted">
                    {p.orders_new_count}
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
                          {p.is_active ? t("active") : t("inactive")}
                        </span>
                      </button>
                      {p.is_featured && (
                        <span className="text-[10px] text-yellow-400">★ {t("featured")}</span>
                      )}
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      {(session?.user?.role === "admin" || session?.user?.id === p.created_by_id) && (
                        <Link href={`/admin/products/${p.id}`}
                          className="text-[12px] px-3 py-1.5 rounded-lg border border-accent/20 text-accent-light hover:bg-accent/10 transition">
                          {t("edit")}
                        </Link>
                      )}
                      {(session?.user?.role === "admin" || session?.user?.id === p.created_by_id) && (
                        <button
                          onClick={() => handleDelete(p.id)}
                          disabled={deleting === p.id}
                          className="text-[12px] px-3 py-1.5 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 transition disabled:opacity-40">
                          {deleting === p.id ? "..." : t("delete")}
                        </button>
                      )}
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