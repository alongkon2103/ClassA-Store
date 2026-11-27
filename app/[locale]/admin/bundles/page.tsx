import { requireAdminPage } from "@/lib/adminAuth"
import { prisma } from "@/lib/prisma"
import { Link } from "@/i18n/routing"
import { setRequestLocale } from "next-intl/server"
import ProductForm from "@/components/admin/products/ProductForm"

export default async function AdminBundlesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ new?: string }> }) {
  await requireAdminPage(["admin"])
  const { locale } = await params
  setRequestLocale(locale)
  const th = locale === "th"
  const query = await searchParams
  if (query.new === "1") return <ProductForm mode="create" initialType="bundle" />
  const bundles = await prisma.products.findMany({
    where: { type: "bundle" }, orderBy: { created_at: "desc" },
    select: { id: true, name_th: true, name_en: true, is_active: true, bundle_product_ids: true, bundle_all_ac_games: true, _count: { select: { product_variants: true } } },
  })
  return <div className="space-y-10 pb-12">
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold">{th ? "แพ็กเกจสมาชิก" : "Membership packages"}</h1><p className="mt-2 text-sm text-text-muted">{th ? "จัดการเกมที่รวม สิทธิ์สมาชิก และแพ็กเกจราคา" : "Manage included games, membership access and pricing packages"}</p></div><Link href="/admin/bundles?new=1" className="inline-flex min-h-11 items-center rounded-lg bg-accent px-4 text-sm font-semibold text-white">{th ? "+ สร้างแพ็กเกจสมาชิก" : "+ New membership package"}</Link></div>
      <div className="grid gap-3 md:grid-cols-2">
        {bundles.map(bundle => <Link key={bundle.id} href={`/admin/products/${bundle.id}`} className="rounded-2xl border border-accent/15 bg-bg-card p-5 transition hover:border-accent/50">
          <h2 className="font-semibold">{th ? bundle.name_th || bundle.name_en : bundle.name_en || bundle.name_th}</h2>
          <p className="mt-2 text-sm text-text-muted">{bundle.bundle_all_ac_games ? (th ? "ทุกเกมปัจจุบันและเกมใหม่" : "All current and future games") : `${bundle.bundle_product_ids.length} ${th ? "เกม" : "games"}`} · {bundle._count.product_variants} {th ? "แพ็กเกจ" : "packages"} · {bundle.is_active ? (th ? "เปิดใช้งาน" : "Active") : (th ? "ปิดใช้งาน" : "Inactive")}</p>
        </Link>)}
      </div>
      {bundles.length === 0 && <p className="rounded-xl border border-border-soft p-5 text-sm text-text-muted">{th ? "ยังไม่มีแพ็กเกจสมาชิก กดสร้างแพ็กเกจเพื่อเริ่มต้น" : "No membership packages yet. Create one to get started."}</p>}
    </section>
  </div>
}
