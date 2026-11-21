import type { Prisma } from "@prisma/client"
import { TikkiesError } from "./tikkies"
import { getBasePlugin, buildWatermarkedJar, signDownload } from "../desktopPlugin"
import { signLicence } from "../desktopLicence"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const supported = { ac_pig_panic: { minecraftVersion: "1.21.4", javaMajor: 21, pluginFilename: "ACPigPanic.jar", pluginFolder: "ACPigPanic" } } as const
export type MinecraftRequest = { email: string; productId: string; machineId: string }

export function parseMinecraftRequest(body: unknown): MinecraftRequest {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new TikkiesError("invalid_input", 400)
  const row = body as Record<string, unknown>
  if (Object.keys(row).some(key => !["email", "productId", "machineId"].includes(key)) ||
      typeof row.email !== "string" || row.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email.trim()) ||
      typeof row.productId !== "string" || !UUID.test(row.productId) ||
      typeof row.machineId !== "string" || !/^[A-Za-z0-9._:-]{8,256}$/.test(row.machineId)) throw new TikkiesError("invalid_input", 400)
  return { email: row.email.trim().toLowerCase(), productId: row.productId, machineId: row.machineId }
}

/** Called within a DB transaction. A failed entitlement/signing/build rolls back a new HWID binding. */
export async function issueTikkiesMinecraft(db: Prisma.TransactionClient, input: MinecraftRequest, now: Date, origin: string) {
  let store: URL
  try {
    store = new URL(origin)
    if (store.protocol !== "https:" || store.pathname !== "/" || store.username || store.password || store.port || store.search || store.hash || !process.env.NEXTAUTH_SECRET) throw new Error()
  } catch { throw new TikkiesError("minecraft_not_configured", 503) }
  const customers = await db.$queryRaw<{ id: string; email: string | null; nativeStatus: string | null; hwid: string | null }[]>`
    SELECT id, email, "nativeStatus", hwid FROM users WHERE lower(btrim(email)) = ${input.email} LIMIT 2`
  if (customers.length > 1) throw new TikkiesError("identity_conflict", 409)
  const customer = customers[0]
  if (!customer) throw new TikkiesError("game_not_owned", 403)
  if (customer.nativeStatus === "KICKED") throw new TikkiesError("account_blocked", 403)
  const product = await db.products.findFirst({ where: { id: input.productId, type: "desktop_program", is_active: true }, select: { id: true, program_key: true, name_en: true, name_th: true } })
  if (!product) throw new TikkiesError("game_not_found", 404)
  if (product.program_key !== "ac_pig_panic") throw new TikkiesError("minecraft_not_supported", 409)
  const entitlement = await db.user_program_access.findUnique({ where: { user_id_product_id: { user_id: customer.id, product_id: product.id } }, select: { status: true, expires_at: true } })
  if (!entitlement || entitlement.status !== "ACTIVE") throw new TikkiesError("game_not_owned", 403)
  if (entitlement.expires_at.getTime() <= now.getTime() + 1000) throw new TikkiesError("game_access_expired", 403)
  if (customer.hwid !== null && customer.hwid !== input.machineId) throw new TikkiesError("minecraft_device_mismatch", 409)

  const meta = getBasePlugin(product.program_key)
  if (!meta || !/^[A-Za-z0-9._+-]{1,100}$/.test(meta.version)) throw new TikkiesError("minecraft_plugin_unavailable", 503)
  const licence = signLicence(customer.id, entitlement.expires_at, now)
  const built = buildWatermarkedJar(product.program_key, customer.id, customer.email)
  if (!built || built.buffer.length < 1 || built.buffer.length > 64 * 1024 * 1024) throw new TikkiesError("minecraft_plugin_unavailable", 503)

  if (customer.hwid === null) {
    try {
      const claimed = await db.users.updateMany({ where: { id: customer.id, hwid: null }, data: { hwid: input.machineId } })
      if (claimed.count !== 1) {
        const current = await db.users.findUnique({ where: { id: customer.id }, select: { hwid: true } })
        if (current?.hwid !== input.machineId) throw new TikkiesError("minecraft_device_mismatch", 409)
      }
    } catch (error) {
      if ((error as { code?: string }).code === "P2002") throw new TikkiesError("minecraft_device_in_use", 409)
      throw error
    }
  }
  const { exp, sig } = signDownload(customer.id, product.program_key, meta.version)
  const url = new URL("/api/desktop/plugin/download", store)
  url.search = new URLSearchParams({ program: product.program_key, account: customer.id, v: meta.version, exp: String(exp), sig }).toString()
  return {
    schemaVersion: 1, gameId: product.id, name: (product.name_th || product.name_en).slice(0, 300), programKey: product.program_key,
    server: supported[product.program_key], plugin: { version: meta.version, sha256: built.sha256, size: built.buffer.length, url: url.href },
    licence: { token: licence.token, notAfter: licence.notAfter, account: customer.id },
    expiresAt: entitlement.expires_at.getUTCFullYear() >= 9000 ? null : entitlement.expires_at.toISOString(),
  }
}
