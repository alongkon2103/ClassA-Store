// GET  /api/admin/partner-store/products/[id]/splits
//   → current commission split + the roster of internal `partners` to pick from.
// PUT  same path, body { splits: [{ partner_id, pct }] }
//   → replaces the split for this game. Non-empty splits MUST sum to 100
//     (splitting the whole commission). An empty list clears the split.
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { validateAdmin } from "@/lib/adminAuth"

export const runtime = "nodejs"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response
  const { id } = await params

  const [product, partners] = await Promise.all([
    prisma.partner_products.findUnique({
      where: { id },
      select: {
        id: true, name_th: true, name_en: true,
        commission_pending_thb: true, commission_paid_thb: true,
        splits: { select: { partner_id: true, pct: true } },
      },
    }),
    prisma.partners.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ])
  if (!product) return NextResponse.json({ error: "not found" }, { status: 404 })

  return NextResponse.json({
    product: {
      id: product.id, name_th: product.name_th, name_en: product.name_en,
      commission_pending_thb: product.commission_pending_thb == null ? 0 : Number(product.commission_pending_thb),
      commission_paid_thb: product.commission_paid_thb == null ? 0 : Number(product.commission_paid_thb),
    },
    splits: product.splits.map((s) => ({ partner_id: s.partner_id, pct: Number(s.pct) })),
    partners,
  })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response
  const { id } = await params
  const body = await req.json().catch(() => ({}))

  const raw: Array<{ partner_id?: string; pct?: number }> = Array.isArray(body.splits) ? body.splits : []
  // Clean: drop blanks, coerce pct, reject invalid.
  const splits = raw
    .filter((s) => s.partner_id && typeof s.pct === "number" && s.pct > 0)
    .map((s) => ({ partner_id: String(s.partner_id), pct: Math.round(Number(s.pct) * 100) / 100 }))

  // No duplicate partners.
  const ids = new Set(splits.map((s) => s.partner_id))
  if (ids.size !== splits.length) {
    return NextResponse.json({ error: "duplicate_partner" }, { status: 400 })
  }
  // Non-empty splits must sum to exactly 100 (allow a tiny rounding epsilon).
  if (splits.length > 0) {
    const sum = splits.reduce((a, s) => a + s.pct, 0)
    if (Math.abs(sum - 100) > 0.01) {
      return NextResponse.json({ error: "must_sum_100", sum }, { status: 400 })
    }
  }

  const product = await prisma.partner_products.findUnique({ where: { id }, select: { id: true } })
  if (!product) return NextResponse.json({ error: "not found" }, { status: 404 })

  // Replace atomically: clear old rows, insert the new set.
  const ops: Prisma.PrismaPromise<unknown>[] = [
    prisma.partner_commission_splits.deleteMany({ where: { partner_product_id: id } }),
  ]
  for (const s of splits) {
    ops.push(prisma.partner_commission_splits.create({
      data: { partner_product_id: id, partner_id: s.partner_id, pct: s.pct },
    }))
  }
  await prisma.$transaction(ops)

  return NextResponse.json({ ok: true, count: splits.length })
}
