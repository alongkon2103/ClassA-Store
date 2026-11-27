import { NextResponse } from "next/server"
import { validateAdmin } from "@/lib/adminAuth"
import { prisma } from "@/lib/prisma"
import { reorderFunctions, functionError } from "@/lib/productFunctions"

export const runtime = "nodejs"
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response
  try {
    const { id } = await params
    return NextResponse.json(await reorderFunctions(prisma, id, await req.json()))
  } catch (error) {
    const result = functionError(error)
    return NextResponse.json(result.body, { status: result.status })
  }
}
