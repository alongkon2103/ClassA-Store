// app/api/admin/users/search/route.ts
//
// GET ?q=... → up to 10 users matching the query on username OR email
// (case-insensitive). Powers the affiliate-picker combobox in /admin/affiliates.

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateAdmin } from "@/lib/adminAuth"

export async function GET(req: NextRequest) {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? ""
  if (q.length < 2) return NextResponse.json([])

  const users = await prisma.users.findMany({
    where: {
      OR: [
        { username: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { id: true, username: true, email: true, avatar: true, role: true },
    take: 10,
    orderBy: { username: "asc" },
  })

  return NextResponse.json(users)
}
