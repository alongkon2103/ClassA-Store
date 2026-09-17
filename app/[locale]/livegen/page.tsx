import { notFound } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { setRequestLocale } from "next-intl/server"
import { getFeatureFlags } from "@/lib/featureFlags"
import Navbar from "@/components/Navbar"
import LiveEditor from "@/components/livegen/LiveEditor"
import { toLivegenFunctions } from "@/lib/maki"

// สร้างรูปไลฟ์ — editor แบบ Canva (Fabric.js) ตาม designer.html
// ดู/ใช้/ดาวน์โหลดได้โดยไม่ต้องล็อกอิน · บันทึกโปรเจค/อัปโหลดรูปต้องล็อกอิน
// ?game=<productId> = เปิดแท็บรูปฟังก์ชันของเกมนั้น · ?project=<id> = เปิดโปรเจคที่บันทึกไว้ · ?template=<id> = เท็มเพลตที่แอดมินทำ
export const dynamic = "force-dynamic"

export default async function LiveGenPage({ params, searchParams }: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ game?: string; project?: string; template?: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const flags = await getFeatureFlags()
  if (!flags.livegen_enabled) notFound()

  const [sp, session, gifts, games, templates, makiGames] = await Promise.all([
    searchParams,
    getServerSession(authOptions),
    prisma.gifts.findMany({
      where: { is_active: true },
      orderBy: { sort_order: "asc" },
      select: { id: true, name: true, image_url: true, diamonds: true },
    }),
    // เกมที่มีรูปฟังก์ชัน → แท็บ "ฟังก์ชัน" ให้ลูกค้าเลือกรูปวางเอง
    prisma.products.findMany({
      where: { is_active: true, product_functions: { some: { image_url: { not: null } } } },
      select: {
        id: true, name_th: true, name_en: true,
        product_functions: {
          where: { image_url: { not: null } },
          orderBy: { sort_order: "asc" },
          select: { id: true, name: true, label_th: true, label_en: true, image_url: true },
        },
      },
      orderBy: [{ is_featured: "desc" }, { created_at: "desc" }],
    }),
    // เท็มเพลตที่แอดมินเปิดแสดง (หน้า admin: Game Templates)
    prisma.livegen_templates.findMany({
      where: { is_visible: true },
      orderBy: { created_at: "desc" },
      select: { id: true, name: true, kind: true, orientation: true, image_url: true, thumbnail: true, cover_url: true },
    }),
    // เกม Maki ที่เปิดขายในร้าน — รูปฟังก์ชันที่แอดมินอัปโหลดไว้ (partner_products.livegen_functions)
    prisma.partner_products.findMany({
      where: { is_visible: true, coming_soon: false, partner: { is_active: true, integration: "maki_api" } },
      orderBy: { sort_order: "asc" },
      select: { id: true, name_th: true, name_en: true, livegen_functions: true },
    }),
  ])
  const makiFunctionGames = makiGames.flatMap((g) => {
    const fns = toLivegenFunctions(g.livegen_functions)
    return fns.length
      ? [{ id: g.id, name_th: g.name_th, name_en: g.name_en, functions: fns.map((f, i) => ({ id: `${g.id}:${i}`, name: f.name, label_th: null, label_en: null, image_url: f.image_url })) }]
      : []
  })

  return (
    <div className="min-h-screen bg-bg-base flex flex-col">
      <Navbar />
      <LiveEditor
        isAuthenticated={!!session?.user?.id}
        isAdmin={session?.user?.role === "admin"}
        gifts={gifts}
        games={[
          ...games.map((g) => ({
            id: g.id, name_th: g.name_th, name_en: g.name_en,
            functions: g.product_functions.flatMap((f) => (f.image_url ? [{ id: f.id, name: f.name, label_th: f.label_th, label_en: f.label_en, image_url: f.image_url }] : [])),
          })),
          ...makiFunctionGames,
        ]}
        templates={templates.map((x) => ({
          id: x.id, name: x.name, kind: x.kind === "canvas" ? "canvas" : "image",
          orientation: x.orientation === "landscape" ? "landscape" : "portrait",
          preview: x.cover_url ?? (x.kind === "canvas" ? x.thumbnail : x.image_url), // รูปปกที่แอดมินอัปโหลดก่อน
        }))}
        initialGameId={sp.game ?? null}
        initialTemplateId={sp.template ?? null}
        initialProjectId={sp.project ?? null}
      />
    </div>
  )
}
