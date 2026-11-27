//api/admin/products/

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateAdmin } from "@/lib/adminAuth"
import { validateBundleProductIds, validateBundleMembers, validateBundleTikkiesFlag, validateBundleAllAcGamesFlag, readEligibleAcGames } from "@/lib/bundles"
import { validateProductLink } from "@/lib/integrations/tikkiesLibrary"

export async function GET() {
  const admin = await validateAdmin()
  if (!admin.isValid) return admin.response

  const products = await prisma.products.findMany({
    orderBy: { created_at: "desc" },
    include: {
      product_images:  { orderBy: { sort_order: "asc" }, take: 1 },
      product_variants: {
        where: { is_active: true },
        include: {
          _count: { select: { game_keys: { where: { status: "available" } } } },
        },
      },
      _count: { select: { orders: true } },
    },
  })

  const safe = products.map((p) => ({
    ...p,
    price: Number(p.price),
    product_variants: p.product_variants.map((v) => ({
      ...v,
      price: Number(v.price),
      stock: v._count.game_keys,
    })),
  }))

  return NextResponse.json(safe)
}

export async function POST(req: NextRequest) {
  const admin = await validateAdmin()
  if (!admin.isValid) return admin.response

  const body = await req.json()
  if (body.bundle_all_ac_games !== undefined && admin.session?.user.role !== "admin") return NextResponse.json({ error: "Only full admins can manage all-game membership" }, { status: 403 })
  if (body.bundle_includes_tikkies !== undefined && admin.session?.user.role !== "admin") return NextResponse.json({ error: "Only full admins can grant Tikkies membership" }, { status: 403 })
  if (body.type === "bundle" && admin.session?.user.role !== "admin") {
    return NextResponse.json({ error: "Only full admins can manage bundles" }, { status: 403 })
  }
  let bundleProductIds: string[] = []
  let bundleIncludesTikkies = false
  let bundleAllAcGames = false
  try {
    bundleIncludesTikkies = validateBundleTikkiesFlag(body.bundle_includes_tikkies, body.type)
    bundleAllAcGames = validateBundleAllAcGamesFlag(body.bundle_all_ac_games, body.type)
    if (body.type === "bundle") {
      if (body.is_consignment) throw new Error("Bundles cannot be consignment products")
      bundleProductIds = bundleAllAcGames ? (await readEligibleAcGames(prisma)).map(item => item.productId) : validateBundleProductIds(body.bundle_product_ids)
      if (!bundleAllAcGames) await validateBundleMembers(prisma, bundleProductIds)
    } else if (body.bundle_product_ids !== undefined && (!Array.isArray(body.bundle_product_ids) || body.bundle_product_ids.length > 0)) {
      throw new Error("Only bundles can have included games")
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid bundle games" }, { status: 400 })
  }
  let infoPageUrl: string | null
  try { infoPageUrl = validateProductLink(body.info_page_url) } catch { return NextResponse.json({ error: "Invalid game link: use an HTTPS URL" }, { status: 400 }) }
  const { name_en, name_th, slug, description_en, description_th, price, is_active, is_featured, isLower, youtube_url, videos, tutorial_video_url, preview_video_url, type, program_key, download_url } = body

  if (!name_en || !name_th || !slug || !price) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  // Product delivery type. desktop_program requires a unique program_key.
  const productType = type === "bundle" ? "bundle" : type === "desktop_program" ? "desktop_program" : "roblox_whitelist"
  const programKey = productType === "desktop_program" ? String(program_key ?? "").trim() : null
  if (productType === "desktop_program" && !/^[a-z0-9_]{2,40}$/.test(programKey ?? "")) {
    return NextResponse.json({ error: "program_key required (a-z0-9_, 2–40 chars)" }, { status: 400 })
  }
  if (programKey) {
    const dup = await prisma.products.findFirst({ where: { program_key: programKey } })
    if (dup) return NextResponse.json({ error: "program_key already exists" }, { status: 400 })
  }

  // Normalize the YouTube video list; keep the legacy single youtube_url in sync
  // with the first video so the shop ProductModal keeps working.
  const vids: string[] = Array.isArray(videos)
    ? videos.map((s: string) => (s ?? "").trim()).filter(Boolean)
    : (youtube_url ? [String(youtube_url).trim()] : [])

  // Check for duplicate slug
  const existing = await prisma.products.findUnique({ where: { slug } })
  if (existing) return NextResponse.json({ error: "Slug already exists" }, { status: 400 })

  const product = await prisma.products.create({
    data: {
      name_en, name_th, slug,
      info_page_url: infoPageUrl,
      description_en: description_en ?? null,
      description_th: description_th ?? null,
      price,
      is_active:   is_active   ?? true,
      is_featured: is_featured ?? false,
      isLower:     isLower     ?? false,
      type:        productType,
      bundle_product_ids: bundleProductIds,
      bundle_includes_tikkies: bundleIncludesTikkies,
      bundle_all_ac_games: bundleAllAcGames,
      program_key: programKey,
      download_url: productType === "desktop_program" ? (download_url ? String(download_url).trim() : null) : null,
      youtube_url: vids[0] ?? null,
      tutorial_video_url: tutorial_video_url ?? null,
      preview_video_url: preview_video_url ?? null,
      created_by_id: admin?.session?.user.id,
      ...(vids.length > 0 ? { product_videos: { create: vids.map((url, i) => ({ url, sort_order: i })) } } : {}),
    },
  })

  return NextResponse.json({ ...product, price: Number(product.price) }, { status: 201 })
}
