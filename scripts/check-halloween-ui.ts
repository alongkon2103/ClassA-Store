// Only the neutral, previously-earned reward remains. No draw request is ever sent.
import assert from "node:assert/strict"
import { createRequire } from "node:module"
import React, { act } from "react"
const require = createRequire(import.meta.url)
const { JSDOM } = require("jsdom")
const dom = new JSDOM('<html><body><div id="root"></div></body></html>', { url: "http://localhost/th/account/redeem" })
for (const key of ["window", "document", "navigator", "HTMLElement", "Element"]) Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true })
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
require.extensions[".css"] = (module: NodeModule) => { module.exports = { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) } }
const { createRoot } = require("react-dom/client"), { NextIntlClientProvider } = require("next-intl")
const file = require.resolve("../i18n/routing")
require.cache[file] = { id: file, filename: file, loaded: true, exports: { Link: ({ href, children, ...rest }: React.PropsWithChildren<{ href: string }>) => React.createElement("a", { href, ...rest }, children) } } as NodeModule
const PendingReward = require("../components/points/PendingEventReward").default
const draw = { id: "11111111-1111-4111-8111-111111111111", claimedAt: null, result: null, orderId: null, prize: { kind: "game", days: 3, product: { id: "game", type: "roblox_whitelist", name_th: "AC Universe", name_en: "AC Universe", slug: "ac-universe", imageUrl: "/uploads/universe.webp" } } }
const calls: string[] = []
globalThis.fetch = async url => {
  calls.push(String(url))
  if (String(url).startsWith("/api/roblox/verify")) return Response.json({ ok: true, user: { id: 123, username: "CanonicalName", displayName: "My Player", avatarUrl: "https://example.test/avatar.png" } })
  assert.equal(String(url), "/api/events/halloween/claim", "A retired event may only receive an existing prize")
  return Response.json({ draw: { ...draw, claimedAt: "2026-11-01T00:01:00Z", orderId: "order", result: { ign: "CanonicalName", expiresAt: "2026-11-04T00:01:00Z", permanent: false } } })
}
const button = () => { const el = [...document.querySelectorAll<HTMLButtonElement>("button")].find(b => b.textContent === "รับสิทธิ์เล่นเกม"); assert.ok(el); return el }
async function check() {
  const root = createRoot(document.getElementById("root")!)
  await act(async () => root.render(React.createElement(NextIntlClientProvider, { locale: "th", messages: {}, timeZone: "Asia/Bangkok" }, React.createElement(PendingReward, { reward: draw }))))
  assert.ok(document.body.textContent?.includes("รางวัลที่ยังไม่ได้รับ"))
  assert.ok(document.body.textContent?.includes("เล่นฟรี 3 วัน"))
  assert.equal(document.querySelectorAll('img[src*="seasonal"]').length, 0)
  assert.equal(button().disabled, true)
  const input = document.querySelector<HTMLInputElement>("input")!
  await act(async () => { Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!.call(input, "CanonicalName"); input.dispatchEvent(new dom.window.Event("input", { bubbles: true })) })
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 600)) })
  assert.ok(document.querySelector('img[src="https://example.test/avatar.png"]'))
  await act(async () => button().click())
  assert.ok(document.querySelector('a[href="/orders/order"]'))
  assert.equal(calls.filter(url => url === "/api/events/halloween/claim").length, 1)
  await act(async () => root.unmount())
  console.log("Retired event UI: neutral existing-prize card, verified Roblox/avatar and claim/order link remain; no draw or seasonal art")
}
check().catch(error => { console.error(error); process.exit(1) })
