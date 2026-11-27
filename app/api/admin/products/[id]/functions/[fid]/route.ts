import { NextResponse } from "next/server"
import { validateAdmin } from "@/lib/adminAuth"
import { prisma } from "@/lib/prisma"
import { patchFunction, parseFunctionInput, functionError, validateFunctionId, FunctionInputError } from "@/lib/productFunctions"

export const runtime = "nodejs"
type Context = { params: Promise<{ id: string; fid: string }> }
export async function PATCH(req: Request, { params }: Context) {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response
  try {
    const { id, fid } = await params
    return NextResponse.json(await patchFunction(prisma, id, fid, parseFunctionInput(await req.json(), true)))
  } catch (error) {
    const result = functionError(error)
    return NextResponse.json(result.body, { status: result.status })
  }
}
export async function DELETE(_req: Request, { params }: Context) {
  const admin = await validateAdmin(["admin"])
  if (!admin.isValid) return admin.response
  try {
    const { id, fid } = await params
    validateFunctionId(id); validateFunctionId(fid)
    const existing = await prisma.product_functions.findFirst({ where: { id: fid, product_id: id } })
    if (!existing) throw new FunctionInputError("function_not_found", 404)
    await prisma.product_functions.delete({ where: { id: fid } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const result = functionError(error)
    return NextResponse.json(result.body, { status: result.status })
  }
}
