import { NextResponse } from "next/server"
import { validateAdmin } from "@/lib/adminAuth"
import { prisma } from "@/lib/prisma"
import { createFunctions, parseBulkFunctions, functionError } from "@/lib/productFunctions"

export const runtime = "nodejs"
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response
  try {
    const { id } = await params
    const functions = await createFunctions(prisma, id, parseBulkFunctions(await req.json()))
    return NextResponse.json({ functions }, { status: 201 })
  } catch (error) {
    const result = functionError(error)
    return NextResponse.json(result.body, { status: result.status })
  }
}
