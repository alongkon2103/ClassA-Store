import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function DELETE() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    await prisma.user_function_gifts.deleteMany({})
    return NextResponse.json({ ok: true, message: "All mappings cleared" })
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error)?.message }, { status: 500 })
  }
}
