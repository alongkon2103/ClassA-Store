import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { NextRequest, NextResponse } from "next/server"

const { readPresetBindings, savePresetBindings } = require("../lib/integrations/tikkiesPresetBindings")
const { describePresetActions, validateTikkiesBindings } = require("../lib/tikkiesBindings")
const productId = "acc03a88-9090-42d9-9ce2-29f1c853b898", presetId = "11111111-1111-4111-8111-111111111111"
const first = "22222222-2222-4222-8222-222222222222", second = "33333333-3333-4333-8333-333333333333", foreign = "44444444-4444-4444-8444-444444444444"
const actions = [
  { name: "Gacha", trigger: { type: "gift", giftName: "Slowmotion", giftId: 1 }, responses: [{ type: "keypress", key: "g", modifiers: [], holdMs: 0 }] },
  { name: "Gacha", trigger: { type: "gift", giftName: "Heart Me", giftId: 2 }, responses: [{ type: "keypress", key: "g", modifiers: [], holdMs: 0 }] },
  { name: "Unsafe", responses: [{ type: "keypress", key: "g" }, { type: "command", command: "never execute" }] },
]
const functionRow = (id: string) => ({ id, name: "Gacha", label_en: "Gacha", label_th: null, image_url: "/uploads/function.webp", category: "help", default_gift_id: 5655, default_trigger_threshold: 2, default_gift: { id: 5655, name: "Rose", diamonds: 1, image_url: "/uploads/gift.webp", trigger_type: "gift" } })
let binding: unknown = null, locked = false, writes = 0, allowed = true, changeFile = false, source = ""
const row = () => ({ id: presetId, product_id: productId, filename: "Slash.tikkies", url: "/presets/slash.tikkies", tikkies_bindings: binding })
const db: any = {
  $transaction: async (operation: (tx: unknown) => unknown) => { const before = binding; try { return await operation(db) } catch (error) { binding = before; throw error } finally { locked = false } },
  $queryRaw: async (parts: TemplateStringsArray, id: string) => { assert.match(parts.join("?"), /FOR UPDATE/); assert.equal(id, productId); locked = true; return [{ id }] },
  products: { findFirst: async () => ({ id: productId }) },
  product_presets: {
    findFirst: async ({ where }: any) => where.id === presetId && where.product_id === productId ? row() : null,
    updateMany: async ({ where, data }: any) => { assert.ok(locked); assert.equal(where.id, presetId); assert.equal(where.product_id, productId); binding = data.tikkies_bindings; writes++; return { count: 1 } },
  },
  product_functions: { findMany: async () => { if (changeFile) { changeFile = false; await fs.writeFile(source, JSON.stringify([actions[1]])) } return [functionRow(first), functionRow(second)] } },
}
function mock(name: string, exports: unknown) { const file = require.resolve(name); require.cache[file] = { id: file, filename: file, loaded: true, exports } as NodeModule }
mock("../lib/prisma", { prisma: db })
mock("../lib/adminAuth", { validateProductEditor: async (id: string) => { assert.equal(id, productId); return allowed ? { isValid: true } : { isValid: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) } } })
async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "tikkies-bindings-"))
  try {
    await fs.mkdir(path.join(root, "presets")); source = path.join(root, "presets", "slash.tikkies")
    const raw = JSON.stringify({ app: "tikkies-tools", type: "actions", version: 1, actions }); await fs.writeFile(source, raw)
    const options = { uploadRoot: root }, origin = "https://aclassstore.com"
    let view = await readPresetBindings(db, productId, presetId, origin, options)
    assert.equal(view.bindings, null); assert.equal(writes, 0, "Loading never guesses/saves links")
    assert.equal(view.actions[0].supported, true); assert.equal(view.actions[2].supported, false)
    assert.notEqual(view.actions[0].triggerLabel, view.actions[1].triggerLabel, "Duplicate names and keys retain distinct source triggers")
    assert.equal(view.functions.functions[0].giftImageUrl, origin + "/uploads/gift.webp")
    const update = { sourceRevision: view.sourceRevision, entries: [{ functionId: first, actionIndex: 0 }, { functionId: second, actionIndex: 0 }] }
    view = await savePresetBindings(db, productId, presetId, update, origin, options)
    assert.deepEqual(view.bindings.entries, update.entries, "Several Functions may target the same Action")
    assert.equal(await fs.readFile(source, "utf8"), raw)
    for (const entries of [[{ functionId: first, actionIndex: 0 }, { functionId: first.toUpperCase(), actionIndex: 1 }], [{ functionId: foreign, actionIndex: 0 }], [{ functionId: first, actionIndex: 199 }], [{ functionId: first, actionIndex: 2 }]]) {
      await assert.rejects(() => savePresetBindings(db, productId, presetId, { sourceRevision: view.sourceRevision, entries }, origin, options), /bindings_invalid/)
    }
    await assert.rejects(() => savePresetBindings(db, productId, foreign, update, origin, options), /preset_not_found/)
    await assert.rejects(() => savePresetBindings(db, productId, presetId, { ...update, sourceRevision: "f".repeat(64) }, origin, options), /bindings_stale/)
    changeFile = true; await assert.rejects(() => savePresetBindings(db, productId, presetId, update, origin, options), /bindings_stale/)
    await fs.writeFile(source, raw)
    binding = { schemaVersion: 1, ...update, sourceRevision: "f".repeat(64) }
    view = await readPresetBindings(db, productId, presetId, origin, options)
    assert.equal(view.bindingError, "bindings_stale"); assert.equal(view.bindings, null)
    assert.throws(() => validateTikkiesBindings(binding, view.sourceRevision, actions, [functionRow(first), functionRow(second)]), /bindings_stale/)
    assert.equal(describePresetActions(actions)[2].supported, false)
    assert.equal(describePresetActions([{ responses: [{ type: "keypress", key: "g\n" }] }])[0].supported, false)
    assert.equal(describePresetActions([{ responses: [{ type: "keypress", key: "g", modifiers: ["ctrl\n"] }] }])[0].supported, false)

    const actual = require("../lib/integrations/tikkiesPresetBindings")
    mock("../lib/integrations/tikkiesPresetBindings", { ...actual, readPresetBindings: async () => view, savePresetBindings: async () => { writes++; return view } })
    const route = require("../app/api/admin/products/[id]/presets/[presetId]/bindings/route")
    const context = { params: Promise.resolve({ id: productId, presetId }) }
    const request = (method: string, body?: unknown, query = "") => new NextRequest(origin + "/api/admin/products/" + productId + "/presets/" + presetId + "/bindings" + query, { method, headers: { "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
    allowed = false; const before = writes
    assert.equal((await route.GET(request("GET"), context)).status, 403)
    assert.equal((await route.PUT(request("PUT", update), context)).status, 403); assert.equal(writes, before)
    allowed = true
    assert.equal((await route.GET(request("GET", undefined, "?email=other@example.com"), context)).status, 400)
    let response = await route.GET(request("GET"), context); assert.equal(response.status, 200); assert.match(response.headers.get("cache-control")!, /no-store/)
    response = await route.PUT(request("PUT", update), context); assert.equal(response.status, 200)
    console.log("PASS explicit preset bindings: same-product authorization, source revision, row lock/recheck, duplicate targets, duplicate Function rejection, unsupported actions, artwork and immutable file")
  } finally { await fs.rm(root, { recursive: true, force: true }) }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
