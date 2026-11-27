"use client"

import { useState, useMemo } from "react"
import { Link, useRouter } from "@/i18n/routing"
import { useTranslations, useLocale } from "next-intl"
import { useSession } from "next-auth/react"
import { getImageUrl } from "@/lib/getImageUrl"
import { filterProducts, getListPage, getProductPricing, productName, type ProductFilters } from "./product-list-model"

type AdminProduct = {
  id: string
  name_th: string | null
  name_en: string | null
  slug: string
  type: string
  price: number
  created_at: string | null
  is_active: boolean
  is_featured: boolean
  created_by_id: string | null
  orders_new_count: number
  product_images?: { url: string }[]
  product_variants: {
    id: string
    label_th: string | null
    label_en: string | null
    variant_type: string | null
    price: number
  }[]
}

const control = "w-full min-w-0 rounded-lg border border-border-soft bg-bg-input px-3 py-2.5 text-[13px] text-text-base outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25"
const quietButton = "rounded-lg border border-border-soft px-3 py-2 text-[12px] text-text-base transition hover:bg-bg-card-hover focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-40 disabled:cursor-not-allowed"

export default function ProductsClient({ products }: { products: AdminProduct[] }) {
  const router = useRouter()
  const t = useTranslations("Admin")
  const locale = useLocale()
  const th = locale === "th"
  const { data: session } = useSession()
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<ProductFilters["status"]>("all")
  const [type, setType] = useState("all")
  const [sort, setSort] = useState<ProductFilters["sort"]>("newest")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null)
  const filtered = useMemo(() => filterProducts(products, { search, status, type, sort, locale }), [products, search, status, type, sort, locale])
  const result = getListPage(filtered, page, pageSize)
  const hasFilters = !!search || status !== "all" || type !== "all"

  const resetFilters = () => { setSearch(""); setStatus("all"); setType("all"); setPage(1) }
  const typeName = (value: string) => value === "desktop_program" ? (th ? "โปรแกรมคอมพิวเตอร์" : "Desktop program") : value === "roblox_whitelist" ? "Roblox" : value

  const mutateProduct = async (product: AdminProduct, action: "delete" | "toggle") => {
    if (action === "delete" && !confirm(t("delete_product_confirm"))) return
    setBusy(product.id)
    setNotice(null)
    try {
      const response = await fetch(`/api/admin/products/${product.id}`, action === "delete" ? { method: "DELETE" } : {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_active: !product.is_active }),
      })
      if (!response.ok) {
        setNotice({ error: true, text: th ? `ไม่สามารถ${action === "delete" ? "ลบ" : "เปลี่ยนสถานะ"}สินค้า “${productName(product, locale)}” ได้ กรุณาลองอีกครั้ง` : `Could not ${action === "delete" ? "delete" : "update"} “${productName(product, locale)}”. Please try again.` })
        return
      }
      setNotice({ error: false, text: th ? (action === "delete" ? "ลบสินค้าแล้ว" : "บันทึกสถานะสินค้าแล้ว") : (action === "delete" ? "Product deleted." : "Product status saved.") })
      router.refresh()
    } catch {
      setNotice({ error: true, text: th ? "เชื่อมต่อไม่สำเร็จ กรุณาตรวจสอบสถานะแล้วลองอีกครั้ง" : "Connection failed. Please check the current status and try again." })
    } finally { setBusy(null) }
  }

  return (
    <div className="min-w-0 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-bold">{t("products")}</h1>
          <p className="mt-1 text-[13px] text-text-muted">{th ? "จัดการสินค้า ราคา และการแสดงผลหน้าร้าน" : "Manage products, pricing and storefront visibility."}</p>
        </div>
        <Link href="/admin/products/new" className="rounded-lg bg-accent px-4 py-2.5 text-[13px] font-semibold text-white transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">+ {t("new_product")}</Link>
      </div>

      {notice && <div role={notice.error ? "alert" : "status"} className={`rounded-lg border p-3 text-[13px] ${notice.error ? "border-red-500/30 bg-red-500/10 text-hot" : "border-success/30 bg-[var(--color-success-bg)] text-success"}`}>{notice.text}</div>}

      <div className="rounded-xl border border-border-soft bg-bg-card p-4">
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_180px_160px_160px]">
          <label className="min-w-0 space-y-1.5 text-[12px] text-text-muted">
            <span>{th ? "ค้นหาสินค้า" : "Search products"}</span>
            <input type="search" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder={th ? "ชื่อไทย / อังกฤษ หรือ slug" : "Thai / English name or slug"} className={control} />
          </label>
          <label className="min-w-0 space-y-1.5 text-[12px] text-text-muted">
            <span>{th ? "ประเภทสินค้า" : "Product type"}</span>
            <select value={type} onChange={e => { setType(e.target.value); setPage(1) }} className={control}>
              <option value="all">{th ? "ทุกประเภท" : "All types"}</option>
              {[...new Set(["roblox_whitelist", "desktop_program", ...products.map(product => product.type)])].map(value => <option key={value} value={value}>{typeName(value)}</option>)}
            </select>
          </label>
          <label className="min-w-0 space-y-1.5 text-[12px] text-text-muted">
            <span>{th ? "การแสดงผล" : "Visibility"}</span>
            <select value={status} onChange={e => { setStatus(e.target.value as ProductFilters["status"]); setPage(1) }} className={control}>
              {(["all", "active", "inactive", "featured"] as const).map(value => <option key={value} value={value}>{t(value)}</option>)}
            </select>
          </label>
          <label className="min-w-0 space-y-1.5 text-[12px] text-text-muted">
            <span>{th ? "เรียงตาม" : "Sort by"}</span>
            <select value={sort} onChange={e => { setSort(e.target.value as ProductFilters["sort"]); setPage(1) }} className={control}>
              <option value="newest">{th ? "ใหม่ล่าสุด" : "Newest first"}</option>
              <option value="oldest">{th ? "เก่าที่สุด" : "Oldest first"}</option>
              <option value="name">{th ? "ชื่อสินค้า" : "Product name"}</option>
              <option value="orders">{th ? "ยอดสั่งซื้อมากที่สุด" : "Most orders"}</option>
            </select>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[12px]">
          <p role="status" className="text-text-muted">{th ? `พบ ${filtered.length.toLocaleString()} จาก ${products.length.toLocaleString()} สินค้า` : `${filtered.length.toLocaleString()} of ${products.length.toLocaleString()} products`}</p>
          {hasFilters && <button onClick={resetFilters} className="rounded text-accent-light underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-accent">{th ? "ล้างตัวกรอง" : "Reset filters"}</button>}
        </div>
      </div>

      <div className="min-w-0 overflow-hidden rounded-xl border border-border-soft bg-bg-card">
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={th ? "ตารางสินค้า เลื่อนแนวนอนเพื่อดูข้อมูลทั้งหมด" : "Products table. Scroll horizontally for all columns."}>
          <table className="w-full min-w-[760px] text-[13px]">
            <thead><tr className="border-b border-border-soft bg-bg-card-hover text-left text-[12px] text-text-muted">
              <th scope="col" className="px-5 py-3 font-medium">{t("product")}</th>
              <th scope="col" className="px-4 py-3 font-medium">{th ? "ราคา / แพ็กเกจ" : "Pricing / packages"}</th>
              <th scope="col" className="px-4 py-3 font-medium">{th ? "ยอดซื้อใหม่ที่ชำระแล้ว" : "Paid new orders"}</th>
              <th scope="col" className="px-4 py-3 font-medium">{th ? "การแสดงผล" : "Visibility"}</th>
              <th scope="col" className="px-4 py-3 font-medium">{t("actions")}</th>
            </tr></thead>
            <tbody className="divide-y divide-border-soft">
              {result.items.length === 0 && <tr><td colSpan={5} className="px-5 py-14 text-center text-text-muted"><p>{t("no_products_found")}</p>{hasFilters && <button onClick={resetFilters} className="mt-3 text-accent-light underline underline-offset-4">{th ? "ล้างตัวกรองเพื่อดูสินค้าทั้งหมด" : "Reset filters to see all products"}</button>}</td></tr>}
              {result.items.map(product => {
                const name = productName(product, locale)
                const canEdit = session?.user?.role === "admin" || (session?.user?.id === product.created_by_id)
                const pricing = getProductPricing(product)
                return <tr key={product.id} className="transition hover:bg-bg-card-hover">
                  <td className="px-5 py-4"><div className="flex items-center gap-3">
                    {product.product_images?.[0]?.url ? <img src={getImageUrl(product.product_images[0].url)} alt="" className="h-11 w-11 shrink-0 rounded-lg bg-bg-base object-cover" /> : <div aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-bg-base font-semibold text-text-muted">{name.slice(0, 1)}</div>}
                    <div className="min-w-0 max-w-[280px]"><p className="truncate font-medium" title={name}>{canEdit ? <Link href={`/admin/products/${product.id}`} className="hover:text-accent-light focus-visible:outline-2 focus-visible:outline-accent">{name}</Link> : name}</p><p className="mt-0.5 truncate text-[11px] text-text-muted" title={product.slug}>{product.slug}</p><p className="mt-0.5 text-[11px] text-text-muted">{typeName(product.type)}</p></div>
                  </div></td>
                  <td className="px-4 py-4"><p className="whitespace-nowrap font-medium">{pricing.min === null ? "Premium" : `฿${pricing.min.toLocaleString()}${pricing.max !== pricing.min ? ` – ${pricing.max?.toLocaleString()}` : ""}`}</p>
                    {!!product.product_variants.length && <details className="mt-1 max-w-[240px] text-[11px] text-text-muted"><summary className="cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-accent">{th ? `${pricing.packages} แพ็กเกจ` : `${pricing.packages} packages`}{pricing.premium > 0 ? ` · ${pricing.premium} Premium` : ""}</summary><ul className="mt-2 space-y-1 border-l border-border-soft pl-2">{product.product_variants.map(variant => <li key={variant.id} className="break-words">{(locale === "th" ? variant.label_th || variant.label_en : variant.label_en || variant.label_th) || "—"} · {variant.variant_type === "premium" ? "Premium" : `฿${variant.price.toLocaleString()}`}</li>)}</ul></details>}
                  </td>
                  <td className="px-4 py-4 tabular-nums text-text-muted">{product.orders_new_count.toLocaleString()}</td>
                  <td className="px-4 py-4"><div className="flex flex-col items-start gap-1.5">
                    <button onClick={() => void mutateProduct(product, "toggle")} disabled={!canEdit || busy !== null} aria-label={`${th ? "เปลี่ยนการแสดงผล" : "Change visibility"}: ${name}`} aria-pressed={product.is_active} className="flex items-center gap-1.5 rounded text-[12px] enabled:hover:underline focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-default">
                      <span className={`h-2 w-2 rounded-full ${product.is_active ? "bg-success" : "bg-text-muted"}`} /><span className={product.is_active ? "text-success" : "text-text-muted"}>{busy === product.id ? "…" : t(product.is_active ? "active" : "inactive")}</span>
                    </button>
                    {product.is_featured && <span className="text-[11px] text-gold">{t("featured")}</span>}
                  </div></td>
                  <td className="px-4 py-4">{canEdit && <div className="flex items-start gap-3"><Link href={`/admin/products/${product.id}`} aria-label={`${t("edit")}: ${name}`} className="rounded-lg border border-accent/25 px-3 py-1.5 text-[12px] text-accent-light transition hover:bg-accent/10 focus-visible:outline-2 focus-visible:outline-accent">{t("edit")}</Link><details className="text-[12px]"><summary aria-label={`${th ? "การดำเนินการเพิ่มเติม" : "More actions"}: ${name}`} className="cursor-pointer rounded px-1 py-1.5 text-text-muted focus-visible:outline-2 focus-visible:outline-accent">{th ? "เพิ่มเติม" : "More"}</summary><button onClick={() => void mutateProduct(product, "delete")} disabled={busy !== null} className="mt-2 rounded px-1 py-1 text-hot underline underline-offset-4 disabled:opacity-40">{t("delete")}</button></details></div>}</td>
                </tr>
              })}
            </tbody>
          </table>
        </div>
        <nav aria-label={th ? "หน้ารายการสินค้า" : "Product pages"} className="flex flex-wrap items-center justify-between gap-3 border-t border-border-soft px-4 py-3 text-[12px] text-text-muted">
          <div className="flex flex-wrap items-center gap-3"><span>{result.start}–{result.end} / {filtered.length}</span><label className="flex items-center gap-2">{th ? "ต่อหน้า" : "Per page"}<select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }} className="rounded-md border border-border-soft bg-bg-input px-2 py-1.5 text-text-base focus-visible:outline-2 focus-visible:outline-accent">{[10, 25, 50].map(size => <option key={size} value={size}>{size}</option>)}</select></label></div>
          <div className="flex items-center gap-3"><button className={quietButton} disabled={result.page === 1} onClick={() => setPage(result.page - 1)}>{th ? "ก่อนหน้า" : "Previous"}</button><span>{th ? "หน้า" : "Page"} {result.page} / {result.pageCount}</span><button className={quietButton} disabled={result.page === result.pageCount} onClick={() => setPage(result.page + 1)}>{th ? "ถัดไป" : "Next"}</button></div>
        </nav>
      </div>
    </div>
  )
}
