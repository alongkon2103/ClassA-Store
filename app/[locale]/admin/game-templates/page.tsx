import { prisma } from "@/lib/prisma"
import { setRequestLocale } from "next-intl/server"
import GameTemplatesClient, { type TemplateRow } from "./GameTemplatesClient"

// Game Templates: เท็มเพลตรูปไลฟ์ที่แอดมินอัปโหลด ให้ลูกค้าเลือกในหน้าสร้างรูปไลฟ์ (livegen) แล้วแก้ต่อได้
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  const rows = await prisma.livegen_templates.findMany({
    orderBy: { created_at: "desc" },
    select: { id: true, name: true, kind: true, orientation: true, image_url: true, thumbnail: true, cover_url: true, is_visible: true },
  })
  const templates: TemplateRow[] = rows.map((r) => ({
    id: r.id, name: r.name, kind: r.kind === "canvas" ? "canvas" : "image",
    orientation: r.orientation === "landscape" ? "landscape" : "portrait",
    preview: r.kind === "canvas" ? r.thumbnail : r.image_url,
    cover: r.cover_url,
    is_visible: r.is_visible,
  }))

  return <GameTemplatesClient templates={templates} />
}
