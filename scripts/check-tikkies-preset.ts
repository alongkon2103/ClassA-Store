import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import type { PrismaClient } from "@prisma/client"

const { parsePresetRequest, readLocalTikkiesPreset, readTikkiesPreset, promoteTikkiesPreset } = require("../lib/integrations/tikkiesPreset")
const gameId = "acc03a88-9090-42d9-9ce2-29f1c853b898"
const presetId = "11111111-1111-4111-8111-111111111111"
const secondId = "22222222-2222-4222-8222-222222222222"
const now = new Date(), future = new Date(now.getTime() + 86400000)
const actions = [{ id: "gift", name: "Gacha", enabled: true, trigger: { type: "gift", giftId: 5655, repeatCombo: true }, responses: [{ type: "keypress", key: "G", modifiers: [], holdMs: 0 }, { type: "keypress", key: "G", modifiers: [], holdMs: 0 }] }]
let customers = [{ id: "customer", nativeStatus: "ACTIVE" }], access = "owned", platform = "roblox_whitelist", reads = 0, revokeDuringRead = false
let rows: any[] = [], updates: any[] = [], candidateSkips: number[] = [], functionRows: any[] = []
const db: any = {
  $transaction: async (operation: (tx: unknown) => unknown) => operation(db),
  $queryRaw: async (query: TemplateStringsArray, subject: string) => {
    if (query.join("?").includes("product_tikkies_integrations")) return []
    if (query.join("?").includes("FOR UPDATE")) { assert.equal(subject, gameId); return [{ id: gameId }] }
    assert.equal(subject, "buyer@example.com"); return customers
  },
  products: {
    findMany: async () => [{ id: gameId, slug: "ac-slash", name_th: "Slash", name_en: "Slash", description_th: "", description_en: "", type: platform, info_page_url: null, roblox_place_ids: ["123"], product_images: [] }],
    findFirst: async () => platform === "roblox_whitelist" ? { id: gameId } : null,
  },
  orders: { findMany: async () => [{ product_id: gameId, status: access === "refunded" ? "refunded" : "paid", paid_at: now, whitelist_status: "whitelisted", whitelisted_username: "Player_A", expires_at: access === "expired" ? new Date(0) : future }] },
  user_program_access: { findMany: async () => [{ product_id: gameId, status: "ACTIVE", expires_at: future }] },
  point_redemptions: { findMany: async () => [] },
  user_whitelist_access: { findMany: async () => { reads++; return access === "revoked" || (revokeDuringRead && reads > 1) ? [] : [{ product_id: gameId, ign: "player_a", expires_at: future }] } },
  product_functions: { findMany: async () => functionRows },
  product_gifts: { findMany: async () => [] },
  product_presets: {
    findMany: async ({ where, take, skip = 0 }: any) => {
      if (where.filename) { assert.equal(take, 200, "Candidate metadata is read in bounded pages"); candidateSkips.push(skip) }
      return rows.filter(row => row.product_id === where.product_id && (!where.filename || row.filename.toLowerCase().endsWith(where.filename.endsWith.toLowerCase())))
        .sort((a, b) => (a.sort_order ?? Infinity) - (b.sort_order ?? Infinity) || (a.created_at?.getTime() ?? Infinity) - (b.created_at?.getTime() ?? Infinity) || a.id.localeCompare(b.id))
        .slice(skip, take === undefined ? undefined : skip + take)
    },
    updateMany: async (query: any) => { updates.push(query); return { count: rows.some(row => row.id === query.where.id && row.product_id === query.where.product_id) ? 1 : 0 } },
  },
}
async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "tikkies-presets-"))
  try {
    await fs.mkdir(path.join(root, "presets"))
    await fs.writeFile(path.join(root, "presets", "first.tikkies"), JSON.stringify({ app: "tikkies-tools", type: "actions", version: 1, actions }))
    await fs.writeFile(path.join(root, "presets", "second.tikkies"), JSON.stringify(actions))
    await fs.writeFile(path.join(root, "presets", "bad.tikkies"), JSON.stringify({ type: "settings", actions }))
    await fs.writeFile(path.join(root, "presets", "large.tikkies"), " ".repeat(2 * 1024 * 1024 + 1))
    const first = { id: presetId, product_id: gameId, filename: "Slash.tikkies", url: "/presets/first.tikkies", sort_order: 2, created_at: now }
    const second = { ...first, id: secondId, filename: "Second.tikkies", url: "/uploads/presets/second.tikkies", sort_order: 1 }
    rows = [first, { ...first, id: "33333333-3333-4333-8333-333333333333", filename: "Legacy.tfc", url: "/presets/legacy.tfc", sort_order: 0 }, second]
    const options = { uploadRoot: root }
    const read = () => readTikkiesPreset(db as PrismaClient, { email: "buyer@example.com", productId: gameId }, "https://aclassstore.com", options)
    assert.deepEqual(parsePresetRequest({ email: " Buyer@Example.com ", productId: gameId }), { email: "buyer@example.com", productId: gameId })
    for (const body of [{ email: null, productId: gameId }, { email: "buyer@example.com" }, { email: "buyer@example.com", productId: gameId, machineId: "device" }]) assert.throws(() => parsePresetRequest(body), /invalid_input/)
    let result = await read()
    assert.equal(result.preset.id, secondId, "First compatible .tikkies follows explicit ordering; .tfc stays untouched")
    assert.deepEqual(result.actions, actions)
    assert.equal(result.functions.schemaVersion, 1)
    assert.match(result.revision, /^[a-f0-9]{64}$/)
    assert.ok(Date.parse(result.validUntil) <= Date.now() + 60000)
    const previous = result.revision
    await fs.writeFile(path.join(root, "presets", "second.tikkies"), JSON.stringify([...actions, { ...actions[0], id: "follow", trigger: { type: "follow" } }]))
    result = await read(); assert.notEqual(result.revision, previous)
    for (const url of ["https://evil.test/presets/first.tikkies", "/presets/../first.tikkies", "/presets/%2e%2e/first.tikkies", "/presets/first.tikkies?token=x", "file:///tmp/first.tikkies", "/etc/passwd", "/presets/large.tikkies", "/presets/bad.tikkies"]) {
      assert.equal(await readLocalTikkiesPreset({ ...first, url }, "https://aclassstore.com", options), null, url)
    }
    assert.deepEqual((await readLocalTikkiesPreset({ ...first, url: "https://aclassstore.com/presets/first.tikkies" }, "https://aclassstore.com", options)).actions, actions)
    await fs.writeFile(path.join(root, "presets", "too-many.tikkies"), JSON.stringify(Array.from({ length: 201 }, () => actions[0])))
    assert.equal(await readLocalTikkiesPreset({ ...first, url: "/presets/too-many.tikkies" }, "https://aclassstore.com", options), null)
    try {
      await fs.symlink(path.join(root, "presets", "first.tikkies"), path.join(root, "presets", "link.tikkies"), "file")
      assert.equal(await readLocalTikkiesPreset({ ...first, url: "/presets/link.tikkies" }, "https://aclassstore.com", options), null)
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EPERM") throw error; console.log("SKIP file symlink creation: Windows requires symbolic-link privilege") }
    for (const state of ["refunded", "revoked", "expired"]) { access = state; await assert.rejects(read, /game_not_owned|game_access_expired/); } access = "owned"
    customers = [{ id: "customer", nativeStatus: "KICKED" }]; await assert.rejects(read, /game_not_owned|account_blocked/)
    customers = [{ id: "customer", nativeStatus: "ACTIVE" }, { id: "duplicate", nativeStatus: "ACTIVE" }]; await assert.rejects(read, /identity_conflict/); customers.pop()
    platform = "desktop_program"; await assert.rejects(read, /roblox_not_supported/); platform = "roblox_whitelist"
    reads = 0; revokeDuringRead = true; await assert.rejects(read, /game_not_owned/); revokeDuringRead = false
    rows = [{ ...first, filename: "Legacy.tfc" }]; await assert.rejects(read, /game_preset_missing/)
    rows = [...Array.from({ length: 200 }, (_, index) => ({ ...first, id: "10000000-0000-4000-8000-" + index.toString().padStart(12, "0"), url: "/presets/bad.tikkies", sort_order: index })), { ...first, sort_order: 200 }]
    candidateSkips = []
    assert.equal((await read()).preset.id, presetId, "The first compatible candidate can be beyond an invalid first page")
    assert.deepEqual(candidateSkips, [0, 200])
    const functionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    functionRows = [{ id: functionId, name: "Explicit Function", category: "help", label_th: null, label_en: "Explicit Function", image_url: "/uploads/function.webp", default_gift_id: null, default_gift: null, default_trigger_threshold: null }]
    rows = [first]
    const unbound = await read(), sourceBytes = await fs.readFile(path.join(root, "presets", "first.tikkies"), "utf8")
    const file = await readLocalTikkiesPreset(first, "https://aclassstore.com", options)
    const mapped = { ...first, tikkies_bindings: { schemaVersion: 1, sourceRevision: file.contentRevision, entries: [{ functionId, actionIndex: 0 }] } }
    rows = [mapped]
    const bound = await read()
    assert.deepEqual(bound.actions, unbound.actions, "Explicit mappings never rewrite exported Actions")
    assert.deepEqual(bound.bindings, mapped.tikkies_bindings)
    assert.notEqual(bound.revision, unbound.revision, "Bindings participate in the reviewed defaults revision")
    mapped.tikkies_bindings.sourceRevision = "f".repeat(64)
    await assert.rejects(read, /preset_bindings_stale/)
    mapped.tikkies_bindings.sourceRevision = file.contentRevision
    mapped.tikkies_bindings.entries.push({ functionId, actionIndex: 0 })
    await assert.rejects(read, /preset_bindings_invalid/)
    mapped.tikkies_bindings.entries.pop()
    functionRows = []; await assert.rejects(read, /preset_bindings_invalid/, "A removed Function cannot be silently matched by name")
    await fs.writeFile(path.join(root, "presets", "first.tikkies"), "invalid JSON")
    await assert.rejects(read, /preset_bindings_stale/)
    await fs.writeFile(path.join(root, "presets", "first.tikkies"), sourceBytes)
    rows = [first, second]; updates = []
    const promoted = await promoteTikkiesPreset(db, gameId, presetId, "https://aclassstore.com", options)
    assert.equal(promoted.presets[0].id, presetId); assert.equal(updates[0].data.sort_order, 0)
    assert.ok(updates.every(update => update.where.product_id === gameId), "Promotion may only reorder this product's rows")
    assert.equal(await fs.readFile(path.join(root, "presets", "first.tikkies"), "utf8"), JSON.stringify({ app: "tikkies-tools", type: "actions", version: 1, actions }), "Promotion never rewrites the original file")
    console.log("PASS Tikkies product presets: ownership, deterministic order, wrappers, bounded local reads, no traversal/remote/symlink, fresh rights and non-destructive promotion")
  } finally { await fs.rm(root, { recursive: true, force: true }) }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
