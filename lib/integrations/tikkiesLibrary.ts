import { createHash } from "node:crypto"
import type { Prisma } from "@prisma/client"
import { TikkiesError,parseIdentities,type Identity } from "./tikkies"
import {resolveTikkiesCustomer} from "./tikkiesCustomer"
import { getImageUrl } from "../getImageUrl"
import { readFunctionDefaults } from "./tikkiesFunctionDefaults"
import { readGameIntegration } from "./gameIntegrationStorage"
import type { GameIntegration } from "../gameIntegration"
import { GameDefaultsError, stableDefaultsJson, validateGameDefaults } from "../tikkiesGameDefaults"

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const numericId = /^[1-9]\d{0,19}$/
export type RobloxLaunch = { placeId: string; linkCode?: string; launchData?: string }
type Access = "owned" | "locked" | "pending" | "expired" | "revoked" | "refunded"
const normalized = (value: string | null) => (value || "").trim().toLowerCase()
const permanent = (value: Date | null) => value === null || value.getUTCFullYear() >= 9000

export function parseLibraryRequest(body: unknown): { email: string | null; productId?: string;identities?:Identity[] } {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new TikkiesError("invalid_input", 400)
  const data = body as Record<string, unknown>
  if (Object.keys(data).some(key => !["email", "productId","identities"].includes(key)) || !("email" in data)) throw new TikkiesError("invalid_input", 400)
  if (data.email !== null && (typeof data.email !== "string" || data.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim()))) throw new TikkiesError("invalid_input", 400)
  if (data.productId !== undefined && (typeof data.productId !== "string" || !uuid.test(data.productId))) throw new TikkiesError("invalid_input", 400)
  return { email: data.email === null ? null : normalized(data.email as string), ...(data.productId ? { productId: data.productId as string } : {}),...(data.identities===undefined?{}:{identities:parseIdentities({identities:data.identities})}) }
}

// Preserve legacy bare hostnames used by the product editor; never persist an executable scheme.
export function validateProductLink(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null
  if (typeof value !== "string" || value.length > 2048) throw new TikkiesError("invalid_product_link", 400)
  let text = value.trim()
  if (!text) return null
  if (!/^[a-z][a-z\d+.-]*:/i.test(text)) text = "https://" + text
  try {
    const url = new URL(text)
    if (url.protocol !== "https:" || url.username || url.password || !url.hostname.includes(".")) throw new Error()
    return url.href
  } catch { throw new TikkiesError("invalid_product_link", 400) }
}

export function robloxLaunch(link: string | null, placeIds: string[]): RobloxLaunch | null {
  if (!link?.trim()) return numericId.test(placeIds[0] || "") ? { placeId: placeIds[0] } : null
  try {
    const url = new URL(validateProductLink(link)!)
    if (!["www.roblox.com", "roblox.com"].includes(url.hostname) || url.port || url.hash) return null
    const pathId = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?games\/([1-9]\d{0,19})(?:\/[^/]*)?\/?$/i.exec(url.pathname)?.[1]
    const placeId = pathId || (url.pathname === "/games/start" ? url.searchParams.get("placeId") : null)
    if (!placeId || !numericId.test(placeId)) return null
    const allowed = ["placeId", "privateServerLinkCode", "launchData"]
    if ([...url.searchParams.keys()].some(key => !allowed.includes(key) || url.searchParams.getAll(key).length !== 1)) return null
    if (url.searchParams.has("placeId") && url.searchParams.get("placeId") !== placeId) return null
    const code = url.searchParams.get("privateServerLinkCode"), data = url.searchParams.get("launchData")
    if (code !== null && !/^[A-Za-z0-9_-]{1,128}$/.test(code)) return null
    if (data !== null && (data.length > 512 || /[\u0000-\u001f\u007f]/.test(data))) return null
    return { placeId, ...(code ? { linkCode: code } : {}), ...(data ? { launchData: data } : {}) }
  } catch { return null }
}

type Purchase = { product_id: string; status: string; paid_at: Date | null; whitelist_status: string | null; whitelisted_username: string | null; expires_at: Date | null }
type Grant = { product_id: string; ign: string; expires_at: Date }
function orderAccess(order: Purchase, grant: Grant | undefined, now: Date, reward?: Date): { access: Access; expiresAt: string | null } {
  let expiry = order.expires_at
  if (reward && !permanent(expiry) && reward > expiry!) expiry = reward
  const dates = [expiry, grant?.expires_at ?? null].filter((d): d is Date => !permanent(d))
  const end = dates.length ? new Date(Math.min(...dates.map(d => d.getTime()))) : null
  let access: Access
  if (order.status === "refunded") access = "refunded"
  else if (["cancelled", "revoked", "disputed"].includes(order.status) || ["removed", "revoked", "suspended"].includes(order.whitelist_status || "")) access = "revoked"
  else if (order.status === "expired" || order.whitelist_status === "expired") access = "expired"
  else if (!["paid", "Admin Buy"].includes(order.status) || !order.paid_at || order.whitelist_status !== "whitelisted") access = "pending"
  else if (!normalized(order.whitelisted_username) || !grant) access = "revoked"
  else if (end && end <= now) access = "expired"
  else access = "owned"
  return { access, expiresAt: end?.toISOString() ?? null }
}
const plain = (value: string | null) => (value || "").slice(0, 20000).replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim().slice(0, 240)

async function readImageAssets(db: Prisma.TransactionClient, productId: string, origin: string) {
  const rows = await db.product_gifts.findMany({ where: { product_id: productId }, orderBy: [{ sort_order: { sort: "asc", nulls: "last" } }, { id: "asc" }], take: 201,
    select: { id: true, url: true, filename: true } })
  if (rows.length > 200) throw new TikkiesError("image_capacity_exceeded", 503)
  return rows.flatMap(row => {
    if (!row.url || row.url.length > 2048) return []
    try {
      const url = new URL(getImageUrl(row.url), origin)
      if (url.protocol !== "https:" || url.username || url.password || url.href.length > 2048) return []
      return [{ id: row.id, name: row.filename?.trim().slice(0, 300) || "Image", url: url.href }]
    } catch { return [] }
  })
}

const libraryProductSelect = {
  id: true, slug: true, name_th: true, name_en: true, description_th: true, description_en: true, type: true,
  info_page_url: true, roblox_place_ids: true,
  product_images: { orderBy: { sort_order: "asc" }, take: 1, select: { url: true } },
} as const satisfies Prisma.productsSelect

type LibraryProduct = Prisma.productsGetPayload<{ select: typeof libraryProductSelect }>

function libraryProductDetails(product: LibraryProduct, origin: string) {
  let imageUrl: string | null = null
  try {
    const cover = product.product_images[0]?.url
    const url = cover && new URL(getImageUrl(cover), origin)
    if (url && url.protocol === "https:" && !url.username && !url.password) imageUrl = url.href
  } catch { /* Missing cover uses the UI fallback. */ }
  return {
    id: product.id, nameTh: product.name_th, nameEn: product.name_en, imageUrl,
    descriptionTh: plain(product.description_th), descriptionEn: plain(product.description_en),
    shopUrl: new URL("/th/products?slug=" + encodeURIComponent(product.slug), origin).href,
  }
}

async function readComingSoonGames(db: Prisma.TransactionClient, productId?: string) {
  const optedIn = [...new Set((process.env.TIKKIES_COMING_SOON_PRODUCT_IDS ?? "")
    .split(",").map(id => id.trim().toLowerCase()).filter(id => uuid.test(id)))].slice(0, 50)
  const selected = productId ? optedIn.filter(id => id === productId.toLowerCase()) : optedIn
  if (!selected.length) return []
  const products = await db.products.findMany({
    where: { id: { in: selected }, is_active: false, type: "roblox_whitelist", product_tikkies_defaults: { isNot: null } },
    orderBy: [{ display_order: { sort: "asc", nulls: "last" } }, { created_at: "desc" }, { id: "asc" }],
    select: { ...libraryProductSelect, product_tikkies_defaults: { select: { config: true, revision: true } } },
  })
  const candidates = await Promise.all(products.map(async product => {
    if (!product.product_tikkies_defaults) return null
    try {
      const document = validateGameDefaults(product.product_tikkies_defaults.config)
      const revision = createHash("sha256").update(stableDefaultsJson(document)).digest("hex")
      if (document.platform !== "roblox" || product.product_tikkies_defaults.revision !== revision) return null
      const connection = await readGameIntegration(db, product.id)
      return connection.stored && connection.integration.mode === "api" ? { product, integration: connection.integration } : null
    } catch (error) {
      if (error instanceof GameDefaultsError) return null
      throw error
    }
  }))
  return candidates.filter(candidate => candidate !== null)
}

export async function readTikkiesLibrary(db: Prisma.TransactionClient, value: string | null, now: Date, origin: string, productId?: string, identities?:Identity[]) {
  const email = value === null ? null : normalized(value)
  const customer=await resolveTikkiesCustomer(db,email,identities)
  const drafts = await readComingSoonGames(db, productId)
  const canPreviewDraft = Boolean(drafts.length && identities?.length && customer?.nativeStatus === "ACTIVE" &&
    (await db.users.findUnique({ where: { id: customer.id }, select: { role: true } }))?.role === "admin")
  const products = await db.products.findMany({ where: { is_active: true, type: { in: ["roblox_whitelist", "desktop_program"] }, ...(productId && !canPreviewDraft ? { id: productId } : {}) },
    orderBy: [{ display_order: { sort: "asc", nulls: "last" } }, { created_at: "desc" }], take: 501,
    select: libraryProductSelect })
  if (products.length > 500) throw new TikkiesError("catalog_capacity_exceeded", 503)
  const ids = products.map(p => p.id)
  const [orders, programs, rewards] = customer && customer.nativeStatus !== "KICKED" ? await Promise.all([
    db.orders.findMany({ where: { user_id: customer.id, product_id: { in: ids } }, take: 5001, select: { product_id: true, status: true, paid_at: true, whitelist_status: true, whitelisted_username: true, expires_at: true } }),
    db.user_program_access.findMany({ where: { user_id: customer.id, product_id: { in: ids } }, take: 501, select: { product_id: true, status: true, expires_at: true } }),
    db.point_redemptions.findMany({ where: { user_id: customer.id, kind: "game_days" }, take: 5001, select: { result: true } }),
  ]) : [[], [], []]
  if (orders.length > 5000 || programs.length > 500 || rewards.length > 5000) throw new TikkiesError("entitlement_capacity_exceeded", 503)
  const names = [...new Set(orders.map(o => normalized(o.whitelisted_username)).filter(Boolean))]
  const grants = names.length ? await db.user_whitelist_access.findMany({ where: { product_id: { in: ids }, OR: names.map(ign => ({ ign: { equals: ign, mode: "insensitive" as const } })) }, take: 10001, select: { product_id: true, ign: true, expires_at: true } }) : []
  if (grants.length > 10000) throw new TikkiesError("entitlement_capacity_exceeded", 503)
  const byGrant = new Map<string, Grant>(), byReward = new Map<string, Date>()
  const key = (p: string, name: string | null) => p + ":" + normalized(name)
  for (const grant of grants) { const k = key(grant.product_id, grant.ign); if (!byGrant.has(k) || grant.expires_at > byGrant.get(k)!.expires_at) byGrant.set(k, grant) }
  for (const reward of rewards) {
    const r = reward.result as Record<string, unknown> | null
    if (!r || typeof r.product_id !== "string" || typeof r.ign !== "string" || typeof r.expires_at !== "string") continue
    const end = new Date(r.expires_at), k = key(r.product_id, r.ign)
    if (Number.isFinite(end.getTime()) && (!byReward.has(k) || end > byReward.get(k)!)) byReward.set(k, end)
  }
  const entitledPreviewAccounts = new Map<string, { name: string; expiresAt: number }>()
  const games = products.map(product => {
    let access: Access = customer?.nativeStatus === "KICKED" ? "revoked" : "locked", expiresAt: string | null = null
    const purchases = orders.filter(o => o.product_id === product.id)
    if (customer?.nativeStatus !== "KICKED") {
      if (product.type === "desktop_program") {
        const program = programs.find(p => p.product_id === product.id)
        if (program) { access = program.status !== "ACTIVE" ? "revoked" : program.expires_at <= now ? "expired" : "owned"; expiresAt = permanent(program.expires_at) ? null : program.expires_at.toISOString() }
      } else {
        const verdicts = purchases.map(order => {
          const accountKey = key(order.product_id, order.whitelisted_username)
          const verdict = orderAccess(order, byGrant.get(accountKey), now, byReward.get(accountKey))
          const name = order.whitelisted_username?.trim()
          if (canPreviewDraft && verdict.access === "owned" && name && /^[A-Za-z0-9_]{3,20}$/.test(name)) {
            const lookup = normalized(name), expiresAt = verdict.expiresAt === null ? Infinity : Date.parse(verdict.expiresAt)
            if (expiresAt > (entitledPreviewAccounts.get(lookup)?.expiresAt ?? 0)) entitledPreviewAccounts.set(lookup, { name, expiresAt })
          }
          return verdict
        })
        const owned = verdicts.filter(v => v.access === "owned")
        if (owned.length) { access = "owned"; expiresAt = owned.some(v => v.expiresAt === null) ? null : owned.map(v => v.expiresAt!).sort().at(-1)! }
        else if (verdicts.length) access = (["expired", "pending", "refunded", "revoked"] as Access[]).find(status => verdicts.some(v => v.access === status)) || "locked"
      }
    }
    return { ...libraryProductDetails(product, origin),
      platform: product.type === "roblox_whitelist" ? "roblox" : "program", access, expiresAt,
      purchasedAccounts: product.type === "roblox_whitelist" ? [...new Set(purchases.map(o => o.whitelisted_username?.trim()).filter((s): s is string => !!s && /^[A-Za-z0-9_]{3,20}$/.test(s)))].slice(0, 50) : [],
      launch: access === "owned" && product.type === "roblox_whitelist" ? robloxLaunch(product.info_page_url, product.roblox_place_ids) : null }
  }).filter(game => !canPreviewDraft || !productId || game.id === productId.toLowerCase())
  const endings = games.filter(g => g.access === "owned" && g.expiresAt).map(g => Date.parse(g.expiresAt!))
  const requestedOwned = productId && games.some(game => game.id === productId && game.access === "owned")
  const [defaults, imageAssets] = requestedOwned ? await Promise.all([readFunctionDefaults(db, productId, origin), readImageAssets(db, productId, origin)]) : [null, null]
  const integrations = new Map<string, GameIntegration>()
  for (const game of games) if (game.access === "owned" && game.platform === "roblox") {
    const connection = await readGameIntegration(db, game.id)
    // Explicit projection: neither server credentials nor credential hashes belong in public delivery.
    if (connection.stored) integrations.set(game.id, connection.integration)
  }
  const resultGames = games.map(game => {
    const integration = integrations.get(game.id)
    const launch = integration?.mode === "api"
      ? game.launch && integration.placeIds.includes(game.launch.placeId) ? game.launch : { placeId: integration.placeIds[0] }
      : game.launch
    return { ...game, launch, ...(defaults && game.id === productId ? { functionDefaults: defaults, imageAssets } : {}), ...(integration ? { integration } : {}) }
  })
  const previewAccounts = [...entitledPreviewAccounts.values()].slice(0, 50)
  const requestedPreview = previewAccounts.length && drafts.find(({ product }) => product.id === productId?.toLowerCase())
  const previewImages = requestedPreview ? await readImageAssets(db, requestedPreview.product.id, origin) : null
  const draftGames = drafts.slice(0, 500 - resultGames.length).map(({ product, integration }) => {
    const details = { ...libraryProductDetails(product, origin), platform: "roblox" as const, access: "locked" as const, comingSoon: true as const, expiresAt: null }
    if (!previewAccounts.length) return { ...details, purchasedAccounts: [], launch: null }
    const launch = robloxLaunch(product.info_page_url, product.roblox_place_ids)
    return {
      ...details, preview: true as const, integration, ...(previewImages && { imageAssets: previewImages }), purchasedAccounts: previewAccounts.map(account => account.name),
      launch: launch && integration.placeIds.includes(launch.placeId) ? launch : { placeId: integration.placeIds[0] },
    }
  })
  return { schemaVersion: 1, customerLinked: !!customer, checkedAt: now.toISOString(), validUntil: new Date(Math.min(now.getTime() + 60000, ...endings, ...previewAccounts.map(account => account.expiresAt))).toISOString(), games: [...resultGames, ...draftGames] }
}
