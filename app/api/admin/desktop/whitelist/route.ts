// app/api/admin/desktop/whitelist/route.ts
//
// POST → grant / revoke a desktop_program entitlement.
// Body: { plan: "30d" | "permanent" | "revoke", productId, userId?, email? }
//   - userId given  → act on that user directly
//   - email given   → if a user with that email exists, act on them; otherwise
//                     store a PENDING grant applied on their first login
// Entitlement lives in user_program_access (+ desktop_whitelist_grants pending).

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { validateAdmin } from "@/lib/adminAuth"
import { planToExpiry } from "@/lib/desktopEntitlement"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response

  const body = await req.json().catch(() => ({}))
  const plan: string = body.plan
  const productId: string | undefined = typeof body.productId === "string" ? body.productId : undefined
  const userId: string | undefined = typeof body.userId === "string" ? body.userId : undefined
  const rawEmail: string | undefined = typeof body.email === "string" ? body.email.trim().toLowerCase() : undefined

  if (!["30d", "permanent", "revoke"].includes(plan)) {
    return NextResponse.json({ error: "bad plan" }, { status: 400 })
  }
  // Product must be a desktop_program.
  const product = productId
    ? await prisma.products.findFirst({ where: { id: productId, type: "desktop_program" }, select: { id: true } })
    : null
  if (!product) return NextResponse.json({ error: "bad product" }, { status: 400 })

  const revoke = plan === "revoke"
  const expiry = revoke ? null : planToExpiry(plan as "30d" | "permanent")

  const grantUser = async (uid: string) => {
    if (revoke) {
      await prisma.user_program_access.deleteMany({ where: { user_id: uid, product_id: product.id } })
    } else {
      await prisma.user_program_access.upsert({
        where: { user_id_product_id: { user_id: uid, product_id: product.id } },
        create: { user_id: uid, product_id: product.id, expires_at: expiry!, status: "ACTIVE" },
        update: { expires_at: expiry!, status: "ACTIVE", updated_at: new Date() },
      })
    }
  }

  // ── by userId ────────────────────────────────────────────────────────────────
  if (userId) {
    await grantUser(userId)
    revalidatePath("/admin/desktop/users")
    return NextResponse.json({ ok: true, applied: "user", userId })
  }

  // ── by email ─────────────────────────────────────────────────────────────────
  if (!rawEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(rawEmail)) {
    return NextResponse.json({ error: "bad email" }, { status: 400 })
  }
  const existing = await prisma.users.findFirst({
    where: { email: { equals: rawEmail, mode: "insensitive" } },
    select: { id: true },
  })
  if (existing) {
    await grantUser(existing.id)
    await prisma.desktop_whitelist_grants.deleteMany({ where: { email: rawEmail, product_id: product.id } })
    revalidatePath("/admin/desktop/users")
    return NextResponse.json({ ok: true, applied: "user", userId: existing.id })
  }

  // No user yet → pending grant (or remove it on revoke).
  if (revoke) {
    await prisma.desktop_whitelist_grants.deleteMany({ where: { email: rawEmail, product_id: product.id } })
  } else {
    await prisma.desktop_whitelist_grants.upsert({
      where: { email_product_id: { email: rawEmail, product_id: product.id } },
      create: { email: rawEmail, product_id: product.id, expires_at: expiry!, granted_by: admin.session?.user?.id ?? null },
      update: { expires_at: expiry!, granted_by: admin.session?.user?.id ?? null },
    })
  }
  revalidatePath("/admin/desktop/users")
  return NextResponse.json({ ok: true, applied: "pending", email: rawEmail })
}
