import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getFeatureFlags } from "@/lib/featureFlags"
import { sanitizeTiles, sanitizeLayout } from "@/lib/livegenConfig"

// Public-mode draft save. Anyone with a login can save one draft per product,
// independent of whether they own the product. Lookup data (functions/gifts)
// is loaded by the page itself; this route only handles persistence.

type RouteContext = {
  params: Promise<{ productId: string }>
}

export async function GET(_req: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const flags = await getFeatureFlags()
  if (!flags.livegen_enabled) return NextResponse.json({ error: "Disabled" }, { status: 404 })

  const { productId } = await params
  const draft = await prisma.user_livegen_drafts.findUnique({
    where: { user_id_product_id: { user_id: session.user.id, product_id: productId } },
    select: { config: true, updated_at: true },
  })

  return NextResponse.json({
    config: draft?.config ?? null,
    updated_at: draft?.updated_at ?? null,
  })
}

export async function PUT(req: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const flags = await getFeatureFlags()
  if (!flags.livegen_enabled) return NextResponse.json({ error: "Disabled" }, { status: 404 })

  const userId = session.user.id
  const { productId } = await params

  // Ensure product exists before we let a draft reference it — a stale
  // productId from a deleted product would otherwise create an orphan row.
  const product = await prisma.products.findUnique({
    where: { id: productId },
    select: { id: true },
  })
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 })
  }

  const body = await req.json()
  const validFunctionIds = new Set(
    (
      await prisma.product_functions.findMany({
        where: { product_id: productId },
        select: { id: true },
      })
    ).map((f) => f.id),
  )

  const config = {
    tiles: sanitizeTiles(body?.tiles, validFunctionIds),
    layout: sanitizeLayout(body?.layout),
  }

  await prisma.user_livegen_drafts.upsert({
    where: { user_id_product_id: { user_id: userId, product_id: productId } },
    create: { user_id: userId, product_id: productId, config },
    update: { config, updated_at: new Date() },
  })

  return NextResponse.json({ ok: true })
}
