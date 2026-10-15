import assert from "node:assert/strict"
import { createRequire } from "node:module"
import React, { act } from "react"
import { createRoot } from "react-dom/client"
import { themeBootstrap } from "../lib/themeBootstrap"
import { ThemeProvider, useTheme } from "../components/ThemeContext"

const require = createRequire(import.meta.url)
const { JSDOM } = require("jsdom")
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: "http://localhost/th" })
for (const key of ["window", "document", "navigator", "HTMLElement", "localStorage"]) {
  Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true })
}
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
// Node does not load CSS modules; class names do not affect this state/DOM test.
require.extensions[".css"] = (module) => { module.exports = { frame: "frame", seasonal: "seasonal", decorations: "decorations", ghost: "ghost", swarm: "swarm", swarmBat: "swarmBat" } }
const HalloweenFrame = require("../components/HalloweenFrame.tsx").default
const storageKey = "halloween-theme"
const boot = new JSDOM(`<html><head><script>${themeBootstrap}</script></head><body></body></html>`, {
  url: "http://localhost/th", runScripts: "dangerously",
  beforeParse(window: Window) {
    window.localStorage.setItem("theme", "light")
    window.localStorage.setItem(storageKey, "off")
  },
})
assert.equal(boot.window.document.documentElement.dataset.theme, "light")
assert.equal(boot.window.document.documentElement.dataset.seasonalPreference, "off", "Saved theme is applied before app hydration")

const freshVisit = new JSDOM(`<html><head><script>${themeBootstrap}</script></head><body></body></html>`, {
  url: "http://localhost/th", runScripts: "dangerously",
})
assert.equal(freshVisit.window.document.documentElement.dataset.seasonalPreference, "on", "New visitors get Halloween before hydration without saving a preference")
assert.equal(freshVisit.window.localStorage.getItem(storageKey), null, "Default does not overwrite an explicit future choice")

function Probe() {
  const context = useTheme()
  return React.createElement(React.Fragment, null,
    React.createElement("button", { onClick: context.toggleHalloween, "aria-pressed": context.halloweenEnabled }, String(context.halloweenEnabled)),
    React.createElement(HalloweenFrame, null, React.createElement("video", { src: "/preview.mp4" })),
    React.createElement("button", { onClick: context.toggleTheme, "data-normal-theme": true }, context.theme),
  )
}
async function check() {
  const ThemeBootstrap = require("../components/ThemeBootstrap.tsx").default
  const bootstrapRoot = createRoot(document.getElementById("root")!)
  await act(async () => bootstrapRoot.render(React.createElement(ThemeBootstrap)))
  assert.equal(document.querySelector("#initial-store-theme"), null, "Theme bootstrap must not render an executable script on client mount")
  await act(async () => bootstrapRoot.unmount())
  localStorage.setItem("theme", "light")
  let root = createRoot(document.getElementById("root")!)
  const render = () => root.render(React.createElement(ThemeProvider, null, React.createElement(Probe)))
  await act(async () => render())
  let button = document.querySelector("button")!
  assert.equal(button.textContent, "true", "Halloween is enabled by default")
  const video = document.querySelector("video")
  assert.ok(document.querySelector('[data-halloween="ghost"] img'), "Seasonal artwork is visible when enabled")
  let motionAllowed = false
  dom.window.matchMedia = (query: string) => ({ matches: motionAllowed, media: query, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true }, onchange: null })
  const frame = document.querySelector(".frame")!
  const enterFrame = (pointerType = "mouse") => {
    const event = new dom.window.MouseEvent("pointerover", { bubbles: true, relatedTarget: document.body })
    Object.defineProperty(event, "pointerType", { value: pointerType })
    frame.dispatchEvent(event)
  }
  await act(async () => enterFrame())
  assert.equal(document.querySelector(".swarm"), null, "No flight when hover or motion preferences disable it")
  motionAllowed = true
  await act(async () => enterFrame("touch"))
  assert.equal(document.querySelector(".swarm"), null, "Touch input does not trigger bats")
  await act(async () => enterFrame())
  assert.equal(document.querySelectorAll(".swarm img").length, 3, "Mouse hover starts three bats")
  const firstBat = document.querySelector(".swarm img")
  await act(async () => frame.dispatchEvent(new dom.window.MouseEvent("pointerout", { bubbles: true, relatedTarget: document.body })))
  assert.equal(document.querySelectorAll(".swarm img").length, 3, "Bats finish flying after pointer leaves")
  await act(async () => enterFrame())
  assert.equal(document.querySelector(".swarm img"), firstBat, "Re-entry does not restart an active flight")
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 1050)) })
  assert.equal(document.querySelector(".swarm"), null, "Flight cleans up and does not loop while hovered")
  await act(async () => enterFrame())
  assert.equal(document.querySelectorAll(".swarm img").length, 3, "A later hover can start another flight")
  await act(async () => button.click())
  assert.equal(button.getAttribute("aria-pressed"), "false")
  assert.equal(document.querySelector("video"), video, "Theme switching preserves the media DOM and playback state")
  assert.equal(document.querySelector('[data-halloween]'), null, "Seasonal artwork disappears in normal mode")
  assert.equal(document.querySelector(".swarm"), null, "Disabling Halloween removes active bats")
  assert.equal(localStorage.getItem(storageKey), "off")
  assert.equal(localStorage.getItem("theme"), "light", "Seasonal switch preserves the user's regular theme")
  await act(async () => root.unmount())
  root = createRoot(document.getElementById("root")!)
  await act(async () => render())
  button = document.querySelector("button")!
  assert.equal(button.textContent, "false", "Preference survives reloading")
  await act(async () => button.click())
  assert.equal(localStorage.getItem(storageKey), "on")
  await act(async () => root.unmount())
  localStorage.setItem(storageKey, "off")
  const proto = Object.getPrototypeOf(localStorage)
  const getItem = proto.getItem, setItem = proto.setItem
  proto.getItem = () => { throw new Error("storage blocked") }
  proto.setItem = () => { throw new Error("storage blocked") }
  root = createRoot(document.getElementById("root")!)
  await act(async () => render())
  await act(async () => document.querySelector("button")!.click())
  assert.equal(document.querySelector("button")!.textContent, "false", "Switch works with blocked storage")
  document.documentElement.dataset.theme = "dark"
  await act(async () => document.querySelector<HTMLButtonElement>("button[data-normal-theme]")!.click())
  assert.equal(document.documentElement.dataset.theme, "light", "Regular theme remains usable when storage is blocked")
  await act(async () => root.unmount())
  proto.getItem = getItem; proto.setItem = setItem
  dom.window.matchMedia = (query: string) => ({ matches: query.includes("prefers-reduced-motion"), media: query, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true }, onchange: null })
  const ImageCarousel = require("../components/products/ImageCarousel.tsx").default
  const { NextIntlClientProvider } = require("next-intl")
  let autoplayTimers = 0, selectedImage = 0
  const originalInterval = globalThis.setInterval
  globalThis.setInterval = ((...args: Parameters<typeof setInterval>) => {
    if (args[1] === 5000) autoplayTimers++
    return originalInterval(...args)
  }) as typeof setInterval
  try {
    root = createRoot(document.getElementById("root")!)
    await act(async () => root.render(React.createElement(NextIntlClientProvider, {
      locale: "en", messages: { Common: { prev_image: "Previous", next_image: "Next" } },
    }, React.createElement(ImageCarousel, { images: ["/first.webp", "/second.webp"], alt: "Product", index: 0, onChange: (index: number) => { selectedImage = index } }))))
    assert.equal(autoplayTimers, 0, "Reduced motion disables gallery autoplay")
    await act(async () => document.querySelector<HTMLButtonElement>('button[aria-label="Next"]')!.click())
    assert.equal(selectedImage, 1, "Manual gallery navigation remains available with reduced motion")
    await act(async () => root.unmount())
  } finally {
    globalThis.setInterval = originalInterval
  }
  console.log("Halloween switch: default, persistence, normal theme preservation and blocked storage OK")
  console.log("Card hover: motion/touch guards, three bats, pointer leave/re-entry and cleanup OK")
  console.log("Reduced motion: gallery autoplay disabled, manual navigation OK")
}
check().catch((e) => { console.error(e); process.exitCode = 1 })
