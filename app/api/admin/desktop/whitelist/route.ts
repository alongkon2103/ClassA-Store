// app/api/admin/desktop/whitelist/route.ts
//
// POST → grant / revoke the desktop (Minecraft) program whitelist.
// Body: { plan: "30d" | "permanent" | "revoke", userId?, email? }
//   - userId given  → act on that user directly
//   - email given   → if a user with that email exists, act on them; otherwise
//                     store a PENDING grant applied on their first login
// Whitelist lives on users.nativeExpiry (+ desktop_whitelist_grants for pending).

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
  const userId: string | undefined = typeof body.userId === "string" ? body.userId : undefined
  const rawEmail: string | undefined = typeof body.email === "string" ? body.email.trim().toLowerCase() : undefined

  if (!["30d", "permanent", "revoke"].includes(plan)) {
    return NextResponse.json({ error: "bad plan" }, { status: 400 })
  }
  const revoke = plan === "revoke"
  const expiry = revoke ? null : planToExpiry(plan as "30d" | "permanent")

  // ── target by userId ────────────────────────────────────────────────────────
  if (userId) {
    const u = await prisma.users.update({
      where: { id: userId },
      data: { nativeExpiry: expiry },
      select: { id: true, email: true },
    })
    // Keep any pending grant for the same email from re-applying on next login.
    if (revoke && u.email) {
      await prisma.desktop_whitelist_grants.deleteMany({ where: { email: u.email.toLowerCase() } })
    }
    revalidatePath("/admin/desktop/users")
    return NextResponse.json({ ok: true, applied: "user", userId: u.id })
  }

  // ── target by email ─────────────────────────────────────────────────────────
  if (!rawEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(rawEmail)) {
    return NextResponse.json({ error: "bad email" }, { status: 400 })
  }

  const existing = await prisma.users.findFirst({
    where: { email: { equals: rawEmail, mode: "insensitive" } },
    select: { id: true },
  })

  if (existing) {
    await prisma.users.update({ where: { id: existing.id }, data: { nativeExpiry: expiry } })
    await prisma.desktop_whitelist_grants.deleteMany({ where: { email: rawEmail } })
    revalidatePath("/admin/desktop/users")
    return NextResponse.json({ ok: true, applied: "user", userId: existing.id })
  }

  // No user yet → pending grant (or remove it on revoke).
  if (revoke) {
    await prisma.desktop_whitelist_grants.deleteMany({ where: { email: rawEmail } })
  } else {
    await prisma.desktop_whitelist_grants.upsert({
      where: { email: rawEmail },
      create: { email: rawEmail, expires_at: expiry!, granted_by: admin.session?.user?.id ?? null },
      update: { expires_at: expiry!, granted_by: admin.session?.user?.id ?? null },
    })
  }
  revalidatePath("/admin/desktop/users")
  return NextResponse.json({ ok: true, applied: "pending", email: rawEmail })
}
