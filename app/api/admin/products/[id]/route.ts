import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateAdmin } from "@/lib/adminAuth"
import { validateBundleProductIds, validateBundleMembers, validateBundleTikkiesFlag, validateBundleAllAcGamesFlag, readEligibleAcGames } from "@/lib/bundles"
import { validateProductLink } from "@/lib/integrations/tikkiesLibrary"

type ConsignmentInput = {
  owner_name: string
  owner_contact: string
  payout_share: number | string
}

type ShareInput = {
  partner_id: string
  share_pct: number | string
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await validateAdmin()
  if (!admin.isValid) return admin.response

  const { id } = await params

  const currentProduct = await prisma.products.findUnique({ where: { id } })
  if (!currentProduct) return NextResponse.json({ error: "Product not found" }, { status: 404 })
  if (currentProduct.type === "bundle" && admin.session?.user.role !== "admin") {
    return NextResponse.json({ error: "Only full admins can manage bundles" }, { status: 403 })
  }
  if (admin.session?.user.role === "partnership" && currentProduct.created_by_id !== admin.session.user.id) {
    return NextResponse.json({ error: "Forbidden: You can only edit your own products" }, { status: 403 })
  }

  const body = await req.json()
  if (body.bundle_all_ac_games !== undefined && admin.session?.user.role !== "admin") return NextResponse.json({ error: "Only full admins can manage all-game membership" }, { status: 403 })
  if (body.bundle_includes_tikkies !== undefined && admin.session?.user.role !== "admin") return NextResponse.json({ error: "Only full admins can grant Tikkies membership" }, { status: 403 })
  if ((body.type === "bundle" || body.bundle_product_ids?.length) && admin.session?.user.role !== "admin") {
    return NextResponse.json({ error: "Only full admins can manage bundles" }, { status: 403 })
  }
  if (body.type !== undefined && body.type !== currentProduct.type && (currentProduct.type === "bundle" || body.type === "bundle")) {
    return NextResponse.json({ error: "Bundle product type cannot be changed" }, { status: 400 })
  }
  if (body.type !== undefined && body.type !== currentProduct.type) {
    const frozenPurchase = await prisma.orders.findFirst({
      where: { status: { in: ["pending", "paid"] }, bundle_snapshot: { path: ["items"], array_contains: [{ productId: id }] } },
      select: { id: true },
    })
    if (frozenPurchase) return NextResponse.json({ error: "A pending or paid bundle purchase uses this game's delivery type" }, { status: 400 })
  }
  try {
    if (body.bundle_all_ac_games !== undefined) body.bundle_all_ac_games = validateBundleAllAcGamesFlag(body.bundle_all_ac_games, currentProduct.type)
    if (Object.prototype.hasOwnProperty.call(body, "bundle_includes_tikkies")) body.bundle_includes_tikkies = validateBundleTikkiesFlag(body.bundle_includes_tikkies, currentProduct.type)
    if (currentProduct.type === "bundle") {
      if (body.is_consignment) throw new Error("Bundles cannot be consignment products")
      const allGames = body.bundle_all_ac_games ?? currentProduct.bundle_all_ac_games
      const ids = allGames ? (await readEligibleAcGames(prisma)).map(item => item.productId) : validateBundleProductIds(Object.prototype.hasOwnProperty.call(body, "bundle_product_ids") ? body.bundle_product_ids : currentProduct.bundle_product_ids, id)
      if (!allGames) await validateBundleMembers(prisma, ids, id)
      body.bundle_product_ids = ids
    } else if (body.bundle_product_ids !== undefined && (!Array.isArray(body.bundle_product_ids) || body.bundle_product_ids.length > 0)) {
      throw new Error("Only bundles can have included games")
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid bundle games" }, { status: 400 })
  }
  if (Object.prototype.hasOwnProperty.call(body, "info_page_url")) {
    try { body.info_page_url = validateProductLink(body.info_page_url) } catch { return NextResponse.json({ error: "Invalid game link: use an HTTPS URL" }, { status: 400 }) }
  }
  if (body.roblox_universe_id !== undefined || body.roblox_place_ids !== undefined) return NextResponse.json({ error: "Use the admin-only Tikkies mapping endpoint" }, { status: 400 })
  const { consignments, partnership_shares, videos, ...rest } = body

  // Normalize the YouTube list (when provided) and keep youtube_url in sync with
  // the first video for the shop ProductModal.
  const videosProvided = Array.isArray(videos)
  const vids: string[] = videosProvided ? videos.map((s: string) => (s ?? "").trim()).filter(Boolean) : []

  const result = await prisma.$transaction(async (tx) => {
    // 1. Update product main info
    const firstOwner = consignments && consignments.length > 0 ? consignments[0] : null
    const updatedProduct = await tx.products.update({
      where: { id },
      data: {
        ...rest,
        owner_name: firstOwner ? firstOwner.owner_name : (rest.owner_name ?? undefined),
        owner_contact: firstOwner ? firstOwner.owner_contact : (rest.owner_contact ?? undefined),
        ...(videosProvided ? { youtube_url: vids[0] ?? null } : {}),
        updated_at: new Date(),
      },
    })

    // 1b. Rebuild the video list when provided (replace-all).
    if (videosProvided) {
      await tx.product_videos.deleteMany({ where: { product_id: id } })
      if (vids.length > 0) {
        await tx.product_videos.createMany({
          data: vids.map((url, i) => ({ product_id: id, url, sort_order: i })),
        })
      }
    }

    // 2. Handle consignments if provided
    if (consignments) {
      await tx.product_consignments.deleteMany({ where: { product_id: id } })
      if (consignments.length > 0) {
        await tx.product_consignments.createMany({
          data: consignments.map((c: ConsignmentInput) => ({
            product_id: id,
            owner_name: c.owner_name,
            owner_contact: c.owner_contact,
            payout_share: Number(c.payout_share)
          }))
        })
      }
    }

    // 3. Handle partnership shares if provided
    if (partnership_shares) {
      await tx.product_shares.deleteMany({ where: { product_id: id } })
      if (partnership_shares.length > 0) {
        await tx.product_shares.createMany({
          data: partnership_shares.map((s: ShareInput) => ({
            product_id: id,
            partner_id: s.partner_id,
            share_pct: Number(s.share_pct)
          }))
        })
      }
    }

    return updatedProduct
  })

  return NextResponse.json({ ...result, price: Number(result.price) })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await validateAdmin()
  if (!admin.isValid) return admin.response

  const { id } = await params

  const currentProduct = await prisma.products.findUnique({ where: { id } })
  if (!currentProduct) return NextResponse.json({ error: "Product not found" }, { status: 404 })
  if (currentProduct.type === "bundle" && admin.session?.user.role !== "admin") {
    return NextResponse.json({ error: "Only full admins can manage bundles" }, { status: 403 })
  }
  if (admin.session?.user.role === "partnership" && currentProduct.created_by_id !== admin.session.user.id) {
    return NextResponse.json({ error: "Forbidden: You can only delete your own products" }, { status: 403 })
  }

  const containingBundle = await prisma.products.findFirst({
    where: { type: "bundle", is_active: true, bundle_product_ids: { has: id }, id: { not: id } },
    select: { id: true },
  })
  if (containingBundle) return NextResponse.json({ error: "Remove this game from active bundles before deleting it" }, { status: 400 })

  const frozenPurchase = await prisma.orders.findFirst({
    where: { status: { in: ["pending", "paid"] }, bundle_snapshot: { path: ["items"], array_contains: [{ productId: id }] } },
    select: { id: true },
  })
  if (frozenPurchase) return NextResponse.json({ error: "This game is included in a pending or paid bundle purchase and cannot be deleted" }, { status: 400 })

  await prisma.products.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}
