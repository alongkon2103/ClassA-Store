// Render the real Home event component with fixture responses; never contacts a real reward endpoint.
import assert from "node:assert/strict"
import { createRequire } from "node:module"
import React, { act } from "react"
const require = createRequire(import.meta.url)
const { JSDOM } = require("jsdom")
const dom = new JSDOM('<html><body><div id="root"></div></body></html>', { url: "http://localhost/th" })
for (const key of ["window", "document", "navigator", "HTMLElement", "Element", "HTMLDialogElement", "Event"]) Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true })
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
dom.window.matchMedia = () => ({ matches: true, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })
dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true }
dom.window.HTMLDialogElement.prototype.close = function () { this.open = false }
require.extensions[".css"] = (module: NodeModule) => { module.exports = { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) } }
const { createRoot } = require("react-dom/client"), { NextIntlClientProvider } = require("next-intl")
// This behavioral test omits animation frames; actual motion is checked in the browser.
const motionTags = new Map()
const motionModule = require.resolve("framer-motion")
require.cache[motionModule] = { id: motionModule, filename: motionModule, loaded: true, exports: {
  useReducedMotion: () => true,
  AnimatePresence: ({ children }: React.PropsWithChildren) => children,
  motion: new Proxy({}, { get: (_, tag: string) => {
    if (!motionTags.has(tag)) motionTags.set(tag, React.forwardRef(function MotionFixture(props: Record<string, unknown>, ref: React.ForwardedRef<HTMLElement>) {
      const clean = Object.fromEntries(Object.entries(props).filter(([key]) => !["initial", "animate", "exit", "transition", "onAnimationComplete"].includes(key)))
      return React.createElement(tag, { ...clean, ref })
    }))
    return motionTags.get(tag)
  } }),
} } as NodeModule
const file = require.resolve("../i18n/routing")
require.cache[file] = { id: file, filename: file, loaded: true, exports: { Link: ({ href, children, ...rest }: React.PropsWithChildren<{ href: string }>) => React.createElement("a", { href, ...rest }, children) } } as NodeModule
const Event = require("../components/seasonal/HalloweenDrawPreview").default
const state = { phase: "upcoming", signedIn: true, available: true, startsAt: "2026-10-30T00:01:00+07:00", endsAt: "2026-11-01T00:01:00+07:00", serverNow: "2026-10-29T12:00:00+07:00", games: [], draw: null as unknown }
const draw = { id: "11111111-1111-4111-8111-111111111111", claimedAt: null, result: null, orderId: null, prize: { kind: "game", days: 3, product: { id: "game", type: "roblox_whitelist", name_th: "AC Universe", name_en: "AC Universe", slug: "ac-universe", imageUrl: "/uploads/universe.webp" } } }
let draws = 0, claims = 0, statusCalls = 0
let resolveStaleStatus: ((response: Response) => void) | null = null
let resolveDuringDrawStatus: ((response: Response) => void) | null = null
let resolveDrawResponse: ((response: Response) => void) | null = null
const calls: string[] = []
globalThis.fetch = async (url, options) => {
  calls.push(String(url))
  if (String(url).includes("roblox/verify")) return Response.json({ ok: true, user: { id: 123, username: "CanonicalName", displayName: "My Player", avatarUrl: "https://example.test/avatar.png" } })
  if (String(url).endsWith("/claim")) { claims++; return Response.json({ draw: { ...draw, claimedAt: "2026-10-30T00:01:00Z", orderId: "order", result: { ign: "CanonicalName", expiresAt: "2026-11-02T00:00:00Z", permanent: false } } }) }
  if (options?.method === "POST") { draws++; return new Promise<Response>(resolve => { resolveDrawResponse = resolve }) }
  statusCalls++
  if (statusCalls === 4) return new Promise<Response>(resolve => { resolveStaleStatus = resolve })
  if (statusCalls === 5) return new Promise<Response>(resolve => { resolveDuringDrawStatus = resolve })
  return Response.json(state)
}
const button = (name: string) => { const el = [...document.querySelectorAll<HTMLButtonElement>("dialog button"), ...document.querySelectorAll<HTMLButtonElement>("button")].find(b => b.textContent === name); assert.ok(el, name); return el }
const settle = (ms = 20) => act(async () => { await new Promise(resolve => setTimeout(resolve, ms)) })
async function check() {
  const root = createRoot(document.getElementById("root")!)
  const render = async () => { await act(async () => root.render(React.createElement(NextIntlClientProvider, { locale: "th", messages: {}, timeZone: "Asia/Bangkok" }, React.createElement(Event, { embedded: true, live: true })))); await settle() }
  await render()
  assert.ok(document.body.textContent?.includes("30 ต.ค."), "Live Home shows the actual event schedule")
  await act(async () => button("ดูกิจกรรม").click()); await settle()
  assert.equal(draws, 0, "Opening an upcoming event must not draw")
  assert.equal(button("ยังไม่เริ่มกิจกรรม").disabled, true)
  await act(async () => button("ปิด").click())
  await act(async () => root.unmount())
  state.phase = "active"; state.serverNow = "2026-10-30T12:00:00+07:00"
  const root2 = createRoot(document.getElementById("root")!)
  await act(async () => root2.render(React.createElement(NextIntlClientProvider, { locale: "th", messages: {}, timeZone: "Asia/Bangkok" }, React.createElement(Event, { embedded: true, live: true })))); await settle()
  await act(async () => button("เปิดฟักทองฟรี").click()); await settle()
  assert.equal(draws, 0, "Banner opens the dialog; explicit draw button spends the free attempt")
  await act(async () => button("เปิดฟักทองฟรี").click()); await settle()
  assert.equal(draws, 1)
  await act(async () => button("ปิด").click()); await settle()
  await act(async () => button("เปิดฟักทองฟรี").click()); await settle()
  assert.ok(resolveDuringDrawStatus)
  await act(async () => { resolveDrawResponse!(Response.json({ draw })); await Promise.resolve() }); await settle(400)
  assert.ok(resolveStaleStatus)
  await act(async () => { resolveStaleStatus!(Response.json(state)); resolveDuringDrawStatus!(Response.json(state)); await Promise.resolve() })
  assert.ok(document.querySelector('dialog input'), "A status read started before drawing must never erase the saved reward")
  assert.ok(document.querySelector('dialog img[src="/uploads/universe.webp"]'), "Game cover is part of the reveal")
  assert.ok(document.querySelector("dialog")?.textContent?.includes("เล่นฟรี 3 วัน"))
  assert.equal(button("รับสิทธิ์เล่นเกม").disabled, true)
  const input = document.querySelector<HTMLInputElement>('dialog input')!
  await act(async () => { Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!.call(input, "CanonicalName"); input.dispatchEvent(new dom.window.Event("input", { bubbles: true })) })
  await settle(600)
  assert.ok(document.querySelector('dialog img[src="https://example.test/avatar.png"]'), "Canonical identity and avatar are verified before claiming")
  await act(async () => button("รับสิทธิ์เล่นเกม").click()); await settle()
  assert.equal(claims, 1); assert.ok(document.querySelector('dialog a[href="/orders/order"]'))
  assert.equal([...document.querySelectorAll("button")].some(b => b.textContent === "ลองลุ้นอีกครั้ง"), false, "Live reward never offers a reroll")
  await act(async () => root2.unmount())
  assert.equal(document.body.style.overflow, "", "Unmount restores page scrolling")
  assert.ok(calls.every(url => url.startsWith("/api/events/halloween") || url.startsWith("/api/roblox/verify")))
  console.log("Halloween UI: schedule guard, explicit draw, reduced motion, game cover/day reveal, Roblox avatar, claim/order result and no reroll OK")
}
check().catch(error => { console.error(error); process.exit(1) })
