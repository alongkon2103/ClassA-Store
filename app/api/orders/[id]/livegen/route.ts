import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

type RouteContext = {
  params: Promise<{ id: string }>
}

type Tile = {
  function_id: string
  gift_id: number | null
  label: string
  side?: "left" | "right"
  order?: number
  gift_scale?: number
  gift_position?: "tl" | "tr" | "bl" | "br"
  label_size?: number
  label_color?: string
  character_image?: string | null
  character_scale?: number
  character_y?: number
}

const clamp = (n: unknown, lo: number, hi: number, def: number) => {
  const v = Number(n)
  if (!Number.isFinite(v)) return def
  return Math.min(hi, Math.max(lo, v))
}

export async function GET(_req: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

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
  const incoming: Tile[] = Array.isArray(body?.tiles) ? body.tiles : []

  // Only keep tiles whose function actually belongs to this order's product —
  // stops a stale client config from saving function_ids that don't exist.
  const validFunctionIds = new Set(
    (
      await prisma.product_functions.findMany({
        where: { product_id: order.product_id },
        select: { id: true },
      })
    ).map((f) => f.id),
  )

  const tiles = incoming
    .filter((t) => t && typeof t.function_id === "string" && validFunctionIds.has(t.function_id))
    .map((t) => ({
      function_id: t.function_id,
      gift_id: t.gift_id == null ? null : Number(t.gift_id),
      label: typeof t.label === "string" ? t.label.slice(0, 64) : "",
      side: t.side === "right" ? "right" : "left",
      order: Number.isFinite(Number(t.order)) ? Number(t.order) : 0,
      gift_scale: clamp(t.gift_scale, 0.1, 0.8, 0.32),
      gift_position: ["tl", "tr", "bl", "br"].includes(t.gift_position as string)
        ? t.gift_position
        : "tl",
      label_size: clamp(t.label_size, 12, 96, 36),
      label_color: typeof t.label_color === "string" ? t.label_color.slice(0, 24) : "auto",
      character_image:
        typeof t.character_image === "string" && t.character_image.length > 0
          ? t.character_image.slice(0, 500)
          : null,
      character_scale: clamp(t.character_scale, 0.3, 2, 1),
      character_y: clamp(t.character_y, -200, 200, 0),
    }))

  const incomingLayout = (body?.layout ?? {}) as Record<string, unknown>
  const layout = {
    column_gap: clamp(incomingLayout.column_gap, 0, 400, 16),
    row_gap: clamp(incomingLayout.row_gap, 0, 200, 16),
    padding: clamp(incomingLayout.padding, 0, 200, 24),
    left_y_offset: clamp(incomingLayout.left_y_offset, -400, 400, 0),
    right_y_offset: clamp(incomingLayout.right_y_offset, -400, 400, 0),
    tile_width: clamp(incomingLayout.tile_width, 120, 600, 280),
    tile_aspect: clamp(incomingLayout.tile_aspect, 0.5, 2.5, 9 / 7),
    bg_color: typeof incomingLayout.bg_color === "string"
      ? incomingLayout.bg_color.slice(0, 24)
      : "transparent",
  }

  const config = { tiles, layout }

  await prisma.user_livegen_configs.upsert({
    where: { order_id: id },
    create: { user_id: userId, order_id: id, config },
    update: { config, updated_at: new Date() },
  })

  return NextResponse.json({ ok: true })
}
