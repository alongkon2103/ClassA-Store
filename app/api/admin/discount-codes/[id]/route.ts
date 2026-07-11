// app/api/admin/discount-codes/[id]/route.ts

import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { validateAdmin } from "@/lib/adminAuth"

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response

  try {
    const { id } = await params
    const body = await req.json()

    const data: Prisma.discount_codesUncheckedUpdateInput = {}
    if (body.is_active !== undefined) data.is_active = Boolean(body.is_active)
    if (body.is_public !== undefined) data.is_public = Boolean(body.is_public)
    if (body.is_auto_select !== undefined) data.is_auto_select = Boolean(body.is_auto_select)
    if (body.note !== undefined) data.note = body.note?.trim() || null

    // Affiliate ownership + per-code commission override.
    if (body.owner_user_id !== undefined) {
      data.owner_user_id = body.owner_user_id?.trim() || null
    }
    if (body.commission_pct !== undefined) {
      if (body.commission_pct === null || body.commission_pct === "") {
        data.commission_pct = null
      } else {
        const c = Number(body.commission_pct)
        if (!Number.isFinite(c) || c < 0 || c > 100) {
          return NextResponse.json({ error: "commission_pct must be 0-100 or empty" }, { status: 400 })
        }
        data.commission_pct = c
      }
    }

    // Auto-select requires visibility — turning auto on forces public on so the
    // two flags can never contradict.
    if (data.is_auto_select === true) data.is_public = true
    // An affiliate code is private (link-applied) — owning it forces off the
    // public/auto flags so it never leaks into the public card list. Check the
    // EFFECTIVE owner (existing owner if this PATCH doesn't touch it), otherwise
    // flipping is_public=true on an already-owned code would leak it.
    const existing = await prisma.discount_codes.findUnique({
      where: { id },
      select: { owner_user_id: true },
    })
    const effectiveOwner =
      body.owner_user_id !== undefined ? (body.owner_user_id?.trim() || null) : existing?.owner_user_id ?? null
    if (effectiveOwner) {
      data.is_public = false
      data.is_auto_select = false
    }

    if (body.code !== undefined) {
      const next = body.code?.trim().toUpperCase()
      if (!next) return NextResponse.json({ error: "Code cannot be empty" }, { status: 400 })
      // collision check (but allow keeping same id)
      const clash = await prisma.discount_codes.findUnique({ where: { code: next } })
      if (clash && clash.id !== id) {
        return NextResponse.json({ error: "Code already exists" }, { status: 400 })
      }
      data.code = next
    }

    if (body.type !== undefined) {
      data.type = body.type === "percent" ? "percent" : "fixed"
    }

    if (body.value !== undefined) {
      const v = Number(body.value)
      if (!Number.isFinite(v) || v <= 0) {
        return NextResponse.json({ error: "value must be > 0" }, { status: 400 })
      }
      if ((data.type ?? body.type) === "percent" && v > 100) {
        return NextResponse.json({ error: "percent value cannot exceed 100" }, { status: 400 })
      }
      data.value = v
    }

    if (body.max_uses !== undefined) {
      data.max_uses = body.max_uses === null || body.max_uses === "" ? null : Number(body.max_uses)
    }

    if (body.per_user_limit !== undefined) {
      data.per_user_limit =
        body.per_user_limit === null || body.per_user_limit === ""
          ? null
          : Number(body.per_user_limit)
    }

    if (body.min_amount !== undefined) {
      data.min_amount = body.min_amount === null || body.min_amount === "" ? null : Number(body.min_amount)
    }

    if (body.product_id !== undefined) {
      data.product_id = body.product_id?.trim() || null
    }

    if (body.starts_at !== undefined) {
      data.starts_at = body.starts_at ? new Date(body.starts_at) : null
    }
    if (body.expires_at !== undefined) {
      data.expires_at = body.expires_at ? new Date(body.expires_at) : null
    }

    data.updated_at = new Date()

    const updated = await prisma.discount_codes.update({
      where: { id },
      data,
    })
    return NextResponse.json(updated)
  } catch (err: unknown) {
    console.error("PATCH discount-code error:", err)
    return NextResponse.json({ error: "Failed to update code" }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response

  try {
    const { id } = await params
    // Redemptions cascade-delete via the FK. Orders that referenced this
    // code keep their discount_amount but discount_code_id → null (SetNull),
    // so historical data isn't lost.
    await prisma.discount_codes.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    console.error("DELETE discount-code error:", err)
    return NextResponse.json({ error: "Failed to delete code" }, { status: 500 })
  }
}
