import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getFeatureFlags } from "@/lib/featureFlags"
import { sanitizeTiles, sanitizeLayout, sanitizeHiddenFunctionIds } from "@/lib/livegenConfig"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(_req: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const flags = await getFeatureFlags()
  if (!flags.livegen_enabled) return NextResponse.json({ error: "Disabled" }, { status: 404 })

  const { id } = await params
  const order = await prisma.orders.findUnique({
    where: { id },
    select: { id: true, user_id: true, status: true, product_id: true },
  })
  if (!order || order.user_id !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const [functions, gifts, saved] = await Promise.all([
    prisma.product_functions.findMany({
      where: { product_id: order.product_id },
      orderBy: { sort_order: "asc" },
      select: {
        id: true,
        name: true,
        label_th: true,
        label_en: true,
        image_url: true,
        default_gift_id: true,
        default_trigger_threshold: true,
      },
    }),
    prisma.gifts.findMany({
      where: { is_active: true },
      orderBy: { sort_order: "asc" },
      select: { id: true, name: true, image_url: true, diamonds: true },
    }),
    prisma.user_livegen_configs.findUnique({
      where: { order_id: id },
      select: { config: true, updated_at: true },
    }),
  ])

  return NextResponse.json({
    functions,
    gifts,
    config: saved?.config ?? null,
    updated_at: saved?.updated_at ?? null,
  })
}

export async function PUT(req: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const flags = await getFeatureFlags()
  if (!flags.livegen_enabled) return NextResponse.json({ error: "Disabled" }, { status: 404 })

  const userId = session.user.id
  const { id } = await params

  const order = await prisma.orders.findUnique({
    where: { id },
    select: { user_id: true, status: true, product_id: true },
  })
  if (!order || order.user_id !== userId) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }
  if (order.status !== "paid" && order.status !== "Admin Buy") {
    return NextResponse.json({ error: "Order not paid" }, { status: 403 })
  }

  const body = await req.json()
  const validFunctionIds = new Set(
    (
      await prisma.product_functions.findMany({
        where: { product_id: order.product_id },
        select: { id: true },
      })
    ).map((f) => f.id),
  )

  const config = {
    tiles: sanitizeTiles(body?.tiles, validFunctionIds),
    layout: sanitizeLayout(body?.layout),
    hidden_function_ids: sanitizeHiddenFunctionIds(body?.hidden_function_ids, validFunctionIds),
  }

  await prisma.user_livegen_configs.upsert({
    where: { order_id: id },
    create: { user_id: userId, order_id: id, config },
    update: { config, updated_at: new Date() },
  })

  return NextResponse.json({ ok: true })
}
