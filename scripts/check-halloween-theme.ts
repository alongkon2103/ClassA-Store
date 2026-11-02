import assert from "node:assert/strict"
import { createRequire } from "node:module"
import React, { act } from "react"
import { createRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { themeBootstrap } from "../lib/themeBootstrap"
import { ThemeProvider, useTheme } from "../components/ThemeContext"

const require = createRequire(import.meta.url)
const { JSDOM } = require("jsdom")
const dom = new JSDOM('<html><body><div id="root"></div></body></html>', { url: "http://localhost/th" })
for (const key of ["window", "document", "navigator", "HTMLElement", "localStorage"]) Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true })
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
require.extensions[".css"] = (module) => { module.exports = { frame: "frame", seasonal: "seasonal", decorations: "decorations", ghost: "ghost", swarm: "swarm" } }
const HalloweenFrame = require("../components/HalloweenFrame").default
function Probe() {
  const context = useTheme()
  return React.createElement(React.Fragment, null,
    React.createElement("output", null, String(context.halloweenEnabled)),
    React.createElement(HalloweenFrame, null, React.createElement("video", { src: "/preview.mp4" })),
    React.createElement("button", { onClick: context.toggleTheme }, context.theme),
  )
}
assert.ok(renderToString(React.createElement(ThemeProvider, null, React.createElement(Probe))).includes("false"), "Server rendering must start in normal mode")
for (const saved of [null, "on", "off"]) {
  const boot = new JSDOM(`<html><head><script>${themeBootstrap}</script></head><body></body></html>`, {
    url: "http://localhost/th", runScripts: "dangerously", beforeParse(window: Window) {
      window.localStorage.setItem("theme", "light")
      if (saved) window.localStorage.setItem("halloween-theme", saved)
    },
  })
  assert.equal(boot.window.document.documentElement.dataset.seasonalPreference, "off", "Old Halloween preferences cannot reactivate the retired theme")
  assert.equal(boot.window.document.documentElement.dataset.theme, "light", "Normal light preference survives retirement")
}
async function check() {
  localStorage.setItem("theme", "light"); localStorage.setItem("halloween-theme", "on")
  let root = createRoot(document.getElementById("root")!)
  await act(async () => root.render(React.createElement(ThemeProvider, null, React.createElement(Probe))))
  assert.equal(document.querySelector("output")!.textContent, "false")
  assert.equal(document.querySelector('[data-halloween]'), null)
  assert.equal(document.querySelector('.decorations'), null)
  const video = document.querySelector("video")
  await act(async () => document.querySelector<HTMLButtonElement>("button")!.click())
  assert.equal(document.documentElement.dataset.theme, "dark")
  assert.equal(document.querySelector("video"), video)
  await act(async () => root.unmount())
  const proto = Object.getPrototypeOf(localStorage), getItem = proto.getItem, setItem = proto.setItem
  proto.getItem = () => { throw new Error("storage blocked") }; proto.setItem = () => { throw new Error("storage blocked") }
  try {
    root = createRoot(document.getElementById("root")!)
    await act(async () => root.render(React.createElement(ThemeProvider, null, React.createElement(Probe))))
    assert.equal(document.querySelector("output")!.textContent, "false")
    await act(async () => document.querySelector<HTMLButtonElement>("button")!.click())
    assert.equal(document.documentElement.dataset.theme, "light")
    await act(async () => root.unmount())
  } finally { proto.getItem = getItem; proto.setItem = setItem }
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
  console.log("Retired Halloween: SSR/bootstrap/stale preference/blocked storage stay off; normal themes, media and reduced-motion gallery remain usable")
}
check().catch(error => { console.error(error); process.exitCode = 1 })
