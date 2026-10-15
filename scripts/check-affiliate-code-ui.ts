// Render the actual admin screen with fake API responses; no real account or DB writes.
import assert from "node:assert/strict"
import { createRequire } from "node:module"
import React, { act } from "react"
import { createRoot } from "react-dom/client"
const require = createRequire(import.meta.url)
const { NextIntlClientProvider } = require("next-intl")
const { JSDOM } = require("jsdom")
const dom = new JSDOM('<html><body><div id="root"></div></body></html>', { url: "http://localhost/th/admin/affiliates" })
for (const key of ["window", "document", "navigator", "HTMLElement", "SVGElement", "Element"]) Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true })
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
const mock = (path: string, exports: unknown) => { const file = require.resolve(path); require.cache[file] = { id: file, filename: file, loaded: true, exports } as NodeModule }
mock("../i18n/routing", { Link: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => React.createElement("a", { href, ...props }, children) })
mock("framer-motion", { AnimatePresence: React.Fragment, motion: { div: ({ children, initial: _i, animate: _a, exit: _e, transition: _t, ...props }: { children: React.ReactNode; initial?: unknown; animate?: unknown; exit?: unknown; transition?: unknown }) => React.createElement("div", props, children) } })
const messages = require("../messages/th.json")
const t = messages.AdminAffiliates
const Admin = require("../app/[locale]/admin/affiliates/AffiliatesClient").default
const A = "11111111-1111-1111-1111-111111111111", B = "22222222-2222-2222-2222-222222222222"
const profile = { user_id: "sample", username: "Sample affiliate", email: null, avatar: null, default_commission_pct: 15, payout_method: null, payout_detail: null, display_name: null, is_active: true, code_count: 1, pending_amount: 0, paid_amount: 0, pending_count: 0 }
let code = { id: "code", code: "SAMPLE", type: "fixed", value: 50, commission_pct: null, is_active: true, used_count: 0, max_uses: null, product_id: A as string | null, product_ids: [] as string[], product_name: "Game A", per_user_limit: null }
const writes: { url: string; body: Record<string, unknown> }[] = []
globalThis.fetch = async (url, init) => {
  const path = String(url)
  if (init?.method === "PATCH" || init?.method === "POST") {
    const body = JSON.parse(String(init.body)); writes.push({ url: path, body })
    if (init.method === "PATCH") code = { ...code, ...body, product_id: null }
    return Response.json({ id: "code", ...body })
  }
  return Response.json(path.endsWith("/settings") ? {} : path.endsWith("/requests") ? [] : path === "/api/admin/affiliates" ? [profile] : { profile, codes: [code], earnings: [], payouts: [], products: [{ id: A, name: "Game A" }, { id: B, name: "Game B" }] })
}
const button = (text: string, scope: ParentNode = document) => {
  const el = [...scope.querySelectorAll<HTMLButtonElement>("button")].find(el => el.textContent?.trim() === text)
  assert.ok(el, `Button found: ${text}`); return el
}
async function check() {
  const root = createRoot(document.getElementById("root")!)
  await act(async () => root.render(React.createElement(NextIntlClientProvider, { locale: "th", messages, timeZone: "Asia/Bangkok" }, React.createElement(Admin))))
  await act(async () => button(t.manage, document.querySelector("tbody")!).click())
  await act(async () => { await new Promise(resolve => setImmediate(resolve)) })
  await act(async () => button(t.edit).click())
  let fieldset = document.querySelector("fieldset")!
  assert.equal(fieldset.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked, true, "Legacy game is preselected")
  await act(async () => fieldset.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')[1].click())
  const editor = fieldset.parentElement!.parentElement!
  await act(async () => button(t.save, editor).click())
  assert.deepEqual(writes[0].body.product_ids, [A, B], "Editing sends both games to PATCH")
  await act(async () => button(t.edit).click())
  fieldset = document.querySelector("fieldset")!
  assert.deepEqual([...fieldset.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].map(el => el.checked), [true, true])
  await act(async () => { for (const el of fieldset.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')) el.click() })
  await act(async () => button(t.save, fieldset.parentElement!.parentElement!).click())
  assert.equal(writes.length, 1, "No API write when selected mode is empty")
  await act(async () => button(t.cancel, fieldset.parentElement!.parentElement!).click())
  const createField = document.querySelector("fieldset")!
  const select = createField.querySelector("select")!
  await act(async () => { select.value = "selected"; select.dispatchEvent(new dom.window.Event("change", { bubbles: true })) })
  await act(async () => { for (const el of createField.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')) el.click() })
  await act(async () => button(t.add_code).click())
  assert.deepEqual(writes[1].body.product_ids, [A, B], "Creating sends both games to POST")
  await act(async () => root.unmount())
  const Picker = require("../components/admin/ProductScopePicker").default
  const removed = "33333333-3333-3333-3333-333333333333"
  let selection: string[] | null = null
  const pickerRoot = createRoot(document.getElementById("root")!)
  await act(async () => pickerRoot.render(React.createElement(NextIntlClientProvider, { locale: "th", messages, timeZone: "Asia/Bangkok" }, React.createElement(Picker, { products: [{ id: A, name: "Game A" }], value: [A, removed], onChange: (ids: string[] | null) => { selection = ids } }))))
  assert.equal(document.querySelectorAll('input[type="checkbox"]').length, 2, "Deleted selected products remain visible for removal")
  await act(async () => document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')[1].click())
  assert.deepEqual(selection, [A])
  await act(async () => pickerRoot.unmount())
  console.log("Affiliate admin UI: legacy selection, multi-game edit/create, reload and empty-selection guard OK")
}
check().catch(error => { console.error(error); process.exitCode = 1 })
