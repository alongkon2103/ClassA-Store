import { NextResponse } from "next/server"
import { HalloweenError } from "@/lib/halloweenDraw"

export const halloweenHeaders = { "Cache-Control": "private, no-store", Vary: "Cookie" }
export async function halloweenBody(req: Request): Promise<Record<string, unknown>> {
  const origins = [new URL(req.url).origin]
  if (process.env.NEXTAUTH_URL) origins.push(new URL(process.env.NEXTAUTH_URL).origin)
  if (!origins.includes(req.headers.get("origin") ?? "")) throw new Error("forbidden_origin")
  if (req.headers.get("content-type")?.split(";")[0].trim() !== "application/json") throw new Error("invalid_input")
  const reader = req.body?.getReader()
  if (!reader) throw new Error("invalid_input")
  let size = 0
  const chunks: Uint8Array[] = []
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.length
      if (size > 1024) { await reader.cancel(); throw new Error("invalid_input") }
      chunks.push(value)
    }
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"))
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("invalid_input")
    return body
  } catch (error) {
    if (error instanceof Error && error.message === "invalid_input") throw error
    throw new Error("invalid_input")
  } finally { reader.releaseLock() }
}
export function halloweenFailure(error: unknown) {
  const code = error instanceof HalloweenError ? error.code : error instanceof Error && ["forbidden_origin", "invalid_input"].includes(error.message) ? error.message : "server_error"
  const status = code === "forbidden_origin" || code === "account_unavailable" ? 403 : code === "invalid_input" || code.startsWith("ign_") ? 400 : code === "not_found" ? 404 : code === "unavailable" || code === "roblox_unavailable" ? 503 : code === "server_error" ? 500 : 409
  if (code === "server_error") console.error("Halloween request failed", error)
  return NextResponse.json({ error: code }, { status, headers: halloweenHeaders })
}
