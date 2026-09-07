import { notFound } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { setRequestLocale } from "next-intl/server"
import { getFeatureFlags } from "@/lib/featureFlags"
import Navbar from "@/components/Navbar"
import LiveEditor from "@/components/livegen/LiveEditor"

// สร้างรูปไลฟ์ — editor แบบ Canva (Fabric.js) ตาม designer.html
// ดู/ใช้/ดาวน์โหลดได้โดยไม่ต้องล็อกอิน · บันทึกโปรเจค/อัปโหลดรูปต้องล็อกอิน
// ?game=<productId> = เริ่มจากเท็มเพลตของเกมนั้น · ?project=<id> = เปิดโปรเจคที่บันทึกไว้
export const dynamic = "force-dynamic"

export default async function LiveGenPage({ params, searchParams }: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ game?: string; project?: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const flags = await getFeatureFlags()
  if (!flags.livegen_enabled) notFound()

  const [sp, session, gifts, games] = await Promise.all([
    searchParams,
    getServerSession(authOptions),
    prisma.gifts.findMany({
      where: { is_active: true },
      orderBy: { sort_order: "asc" },
      select: { id: true, name: true, image_url: true, diamonds: true },
    }),
    // เกมที่มีฟังก์ชัน = ทำเท็มเพลตได้
    prisma.products.findMany({
      where: { is_active: true, product_functions: { some: {} } },
      select: {
        id: true, slug: true, name_th: true, name_en: true,
        product_images: { orderBy: { sort_order: "asc" }, take: 1, select: { url: true } },
        _count: { select: { product_functions: true } },
      },
      orderBy: [{ is_featured: "desc" }, { created_at: "desc" }],
    }),
  ])

  return (
    <div className="min-h-screen bg-bg-base flex flex-col">
      <Navbar />
      <LiveEditor
        isAuthenticated={!!session?.user?.id}
        gifts={gifts}
        games={games.map((g) => ({
          id: g.id, slug: g.slug, name_th: g.name_th, name_en: g.name_en,
          image: g.product_images[0]?.url ?? null, function_count: g._count.product_functions,
        }))}
        initialGameId={sp.game ?? null}
        initialProjectId={sp.project ?? null}
      />
    </div>
  )
}
