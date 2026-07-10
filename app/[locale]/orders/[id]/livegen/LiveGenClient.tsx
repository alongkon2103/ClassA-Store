"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { motion, useMotionValue, LayoutGroup, animate } from "framer-motion"
import { Link } from "@/i18n/routing"
import { getImageUrl } from "@/lib/getImageUrl"

// Curated font set — Thai-friendly fonts first, Latin-only display fonts after.
// `family` is the literal name used both for fontFamily CSS and the Google
// Fonts URL slug (spaces become `+`).
const FONT_OPTIONS = [
  { key: "default", family: null, label: "Default" },
  { key: "kanit", family: "Kanit", label: "Kanit" },
  { key: "mitr", family: "Mitr", label: "Mitr" },
  { key: "prompt", family: "Prompt", label: "Prompt" },
  { key: "bai", family: "Bai Jamjuree", label: "Bai Jamjuree" },
  { key: "sarabun", family: "Sarabun", label: "Sarabun" },
  { key: "anuphan", family: "Anuphan", label: "Anuphan" },
  { key: "bungee", family: "Bungee", label: "Bungee" },
  { key: "bebas", family: "Bebas Neue", label: "Bebas Neue" },
  { key: "anton", family: "Anton", label: "Anton" },
]

// Pre-load all available fonts on mount via a single Google Fonts <link>. This
// also lets `document.fonts.load(...)` resolve quickly inside the canvas render.
const FONT_LINK_HREF = `https://fonts.googleapis.com/css2?${FONT_OPTIONS
  .filter((f) => f.family)
  .map((f) => `family=${encodeURIComponent(f.family!).replace(/%20/g, "+")}:wght@700`)
  .join("&")}&display=swap`

type Gift = {
  id: number
  name: string
  image_url: string | null
  diamonds: number
}

type Func = {
  id: string
  name: string
  label_th: string | null
  label_en: string | null
  image_url: string | null
  default_gift_id: number | null
  default_trigger_threshold: number | null
  // Only set on synthetic Funcs created by "Add card" — points to which real
  // product_function provided the starting character image.
  source_function_id?: string
}

type CharacterLibraryItem = { url: string; name: string }

type Side = "left" | "right"
type GiftPos = "tl" | "tr" | "bl" | "br"

// One gift image on a tile — its own position and size so up to
// MAX_GIFTS_PER_TILE gifts can sit on the same card without overlapping.
export type TileGift = {
  gift_id: number
  scale: number
  x: number
  y: number
}

export type LiveGenConfig = {
  tiles: Array<{
    function_id: string
    // New multi-gift format. Older saves only carry the flat gift_* fields
    // below — migrateTileGifts() folds those into a 1-item array on load.
    gifts?: Array<Partial<TileGift>>
    gift_id: number | null
    label: string
    side?: Side
    order?: number
    gift_scale?: number
    gift_position?: GiftPos
    gift_x?: number
    gift_y?: number
    label_size?: number
    label_color?: string
    label_x?: number
    label_y?: number
    label_font?: string
    label_stroke_color?: string
    label_stroke_width?: number
    character_image?: string | null
    character_scale?: number
    character_y?: number
    name?: string
    source_function_id?: string
  }>
  layout?: Partial<LayoutState>
  // function_ids the user explicitly removed. Kept separate from `tiles` so
  // re-adding via the picker un-hides instead of duplicating the original.
  hidden_function_ids?: string[]
}

type LayoutState = {
  column_gap: number
  row_gap: number
  padding: number
  left_y_offset: number
  right_y_offset: number
  tile_width: number
  tile_aspect: number
  bg_color: string
}

const DEFAULT_LAYOUT: LayoutState = {
  column_gap: 100,
  row_gap: 16,
  padding: 24,
  left_y_offset: 0,
  right_y_offset: 0,
  tile_width: 220,
  tile_aspect: 9 / 7,
  bg_color: "transparent",
}

type Props = {
  // Either order-scoped (paid customer composing for their order) or
  // public-scoped (anyone composing against a product directly). Exactly one
  // of orderId / productId is set — `mode` tells us which.
  mode: "order" | "public"
  orderId?: string
  productId?: string
  // Public mode also needs to know whether the user can save (drafts require
  // login). When false, the save button bounces them to login instead.
  isAuthenticated: boolean
  locale: string
  productName: string
  functions: Func[]
  gifts: Gift[]
  characterLibrary: CharacterLibraryItem[]
  initialConfig: LiveGenConfig | null
}

type TileState = {
  gifts: TileGift[]
  label: string
  label_size: number
  label_color: string
  label_x: number
  label_y: number
  label_font: string
  label_stroke_color: string
  label_stroke_width: number
  character_image: string | null
  character_scale: number
  character_y: number
  side: Side
  order: number
}

const COLOR_PRESETS = [
  { key: "auto", hex: null },
  { key: "green", hex: "#3ecf8e" },
  { key: "red", hex: "#ef4444" },
  { key: "white", hex: "#ffffff" },
  { key: "yellow", hex: "#fbbf24" },
  { key: "orange", hex: "#fb923c" },
  { key: "cyan", hex: "#06b6d4" },
  { key: "pink", hex: "#f472b6" },
]

function resolveLabelColor(tile: TileState): string {
  if (tile.label_color && tile.label_color !== "auto") return tile.label_color
  const s = tile.label.trim()
  if (s.startsWith("+")) return "#3ecf8e"
  if (s.startsWith("-")) return "#ef4444"
  return tile.side === "left" ? "#3ecf8e" : "#ef4444"
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => resolve(img)
    img.onerror = (e) => reject(e)
    img.src = src
  })
}

// Re-number both sides so every tile's `order` is consecutive 0..N-1. Keeps
// gridRow values dense so columns line up — without this, swaps could leave
// gaps that look like one column "drops" below the other.
function normalizeOrders(map: Record<string, TileState>): Record<string, TileState> {
  const left = Object.entries(map).filter(([, t]) => t.side === "left").sort((a, b) => a[1].order - b[1].order)
  const right = Object.entries(map).filter(([, t]) => t.side === "right").sort((a, b) => a[1].order - b[1].order)
  const out: Record<string, TileState> = { ...map }
  left.forEach(([id, t], i) => { out[id] = { ...t, order: i } })
  right.forEach(([id, t], i) => { out[id] = { ...t, order: i } })
  return out
}

// Migrate the legacy 4-corner picker value to free-form percentages so older
// saved configs keep working as the gift becomes draggable.
function cornerToXY(pos: GiftPos | undefined): { x: number; y: number } {
  switch (pos) {
    case "tr": return { x: 0.65, y: 0.03 }
    case "bl": return { x: 0.03, y: 0.65 }
    case "br": return { x: 0.65, y: 0.65 }
    default:   return { x: 0.03, y: 0.03 }
  }
}

const MAX_GIFTS = 3

// Where the 1st/2nd/3rd gift lands when added, so they never spawn stacked on
// top of each other — the user drags them into place from there.
const GIFT_SPAWN_POINTS = [
  { x: 0.03, y: 0.03 },
  { x: 0.65, y: 0.03 },
  { x: 0.03, y: 0.65 },
]

// Fold a saved tile's gift data into the multi-gift array:
//  - new saves carry `gifts` directly
//  - legacy saves carry a single gift in flat fields → 1-item array
//  - unsaved tiles fall back to the product function's default gift
function migrateTileGifts(
  s: LiveGenConfig["tiles"][number] | undefined,
  defaultGiftId: number | null,
): TileGift[] {
  if (Array.isArray(s?.gifts)) {
    return s.gifts
      .filter((g) => g && Number.isFinite(Number(g.gift_id)))
      .slice(0, MAX_GIFTS)
      .map((g, i) => ({
        gift_id: Number(g.gift_id),
        scale: g.scale ?? 0.32,
        x: g.x ?? GIFT_SPAWN_POINTS[i].x,
        y: g.y ?? GIFT_SPAWN_POINTS[i].y,
      }))
  }
  const legacy = cornerToXY(s?.gift_position)
  // Same fallback chain the single-gift loader used: saved value → default.
  const gid = s?.gift_id ?? defaultGiftId
  if (gid == null) return []
  return [
    {
      gift_id: gid,
      scale: s?.gift_scale ?? 0.32,
      x: s?.gift_x ?? legacy.x,
      y: s?.gift_y ?? legacy.y,
    },
  ]
}

export default function LiveGenClient({
  mode,
  orderId,
  productId,
  isAuthenticated,
  locale,
  productName,
  functions,
  gifts,
  characterLibrary,
  initialConfig,
}: Props) {
  const t = useTranslations("LiveGen")

  const giftById = useMemo(() => {
    const m = new Map<number, Gift>()
    gifts.forEach((g) => m.set(g.id, g))
    return m
  }, [gifts])

  const initialTiles = useMemo<Record<string, TileState>>(() => {
    const saved = new Map<string, LiveGenConfig["tiles"][number]>()
    initialConfig?.tiles?.forEach((tt) => saved.set(tt.function_id, tt))
    const half = Math.ceil(functions.length / 2)
    let leftCount = 0
    let rightCount = 0
    const out: Record<string, TileState> = {}
    functions.forEach((f, i) => {
      const s = saved.get(f.id)
      const side: Side = s?.side ?? (i < half ? "left" : "right")
      out[f.id] = {
        gifts: migrateTileGifts(s, f.default_gift_id),
        label: s?.label ?? (locale === "th" ? f.label_th : f.label_en) ?? "",
        label_size: s?.label_size ?? 32,
        label_color: s?.label_color ?? "auto",
        label_x: s?.label_x ?? 0.96,
        label_y: s?.label_y ?? 0.94,
        label_font: s?.label_font ?? "default",
        label_stroke_color: s?.label_stroke_color ?? "#000000",
        label_stroke_width: s?.label_stroke_width ?? 0.08,
        character_image: s?.character_image ?? null,
        character_scale: s?.character_scale ?? 1,
        character_y: s?.character_y ?? 0,
        side,
        // Per-side order so each side starts at 0 regardless of overall index.
        order: s?.order ?? (side === "left" ? leftCount++ : rightCount++),
      }
    })
    // Also seed tile state for custom cards rehydrated from saved config —
    // without this their Func entry has no matching TileState and downstream
    // reads explode with `tile.character_image is undefined`.
    saved.forEach((s, key) => {
      if (!key.startsWith("custom_") || out[key]) return
      out[key] = {
        gifts: migrateTileGifts(s, null),
        label: s.label ?? "",
        label_size: s.label_size ?? 32,
        label_color: s.label_color ?? "auto",
        label_x: s.label_x ?? 0.96,
        label_y: s.label_y ?? 0.94,
        label_font: s.label_font ?? "default",
        label_stroke_color: s.label_stroke_color ?? "#000000",
        label_stroke_width: s.label_stroke_width ?? 0.08,
        character_image: s.character_image ?? null,
        character_scale: s.character_scale ?? 1,
        character_y: s.character_y ?? 0,
        side: s.side ?? "left",
        order: s.order ?? 0,
      }
    })
    return normalizeOrders(out)
  }, [functions, initialConfig, locale])

  // Rehydrate custom Funcs from any saved config so the user sees their
  // previously added cards on next visit. Real functions live in props.
  const initialCustomFuncs = useMemo<Func[]>(() => {
    if (!initialConfig?.tiles) return []
    return initialConfig.tiles
      .filter((t) => t.function_id.startsWith("custom_") && t.source_function_id)
      .map((t) => {
        const src = functions.find((f) => f.id === t.source_function_id)
        return {
          id: t.function_id,
          name: t.name || "Custom",
          label_th: null,
          label_en: null,
          image_url: t.character_image || src?.image_url || null,
          default_gift_id: null,
          default_trigger_threshold: null,
          source_function_id: t.source_function_id,
        }
      })
  }, [initialConfig, functions])

  const [customFuncs, setCustomFuncs] = useState<Func[]>(initialCustomFuncs)
  const [tiles, setTiles] = useState<Record<string, TileState>>(initialTiles)
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(
    () => new Set(initialConfig?.hidden_function_ids ?? []),
  )
  const [layout, setLayout] = useState<LayoutState>({
    ...DEFAULT_LAYOUT,
    ...(initialConfig?.layout ?? {}),
  })
  const [layoutOpen, setLayoutOpen] = useState(false)
  const [editingFunctionId, setEditingFunctionId] = useState<string | null>(null)
  const [giftSearch, setGiftSearch] = useState("")
  const [charPickerOpen, setCharPickerOpen] = useState(false)
  const [addCardPickerOpen, setAddCardPickerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)

  // All cards rendered in the grid: real product_functions + user duplicates,
  // minus anything the user explicitly hid via the remove button. We don't
  // forget hidden ids from `tiles` state so the user's per-tile settings are
  // preserved if they un-hide via the picker later.
  const allFunctions = useMemo(
    () => [...functions.filter((f) => !hiddenIds.has(f.id)), ...customFuncs],
    [functions, customFuncs, hiddenIds],
  )

  const updateLayout = (patch: Partial<LayoutState>) => setLayout((prev) => ({ ...prev, ...patch }))

  // Load Google Fonts once. The stylesheet is shared across the page so multiple
  // tiles using the same family don't re-fetch.
  useEffect(() => {
    if (document.getElementById("livegen-fonts")) return
    const l = document.createElement("link")
    l.id = "livegen-fonts"
    l.rel = "stylesheet"
    l.href = FONT_LINK_HREF
    document.head.appendChild(l)
  }, [])

  const editing = editingFunctionId ? allFunctions.find((f) => f.id === editingFunctionId) : null
  const editingTile = editingFunctionId ? tiles[editingFunctionId] : null

  const filteredGifts = useMemo(() => {
    const q = giftSearch.trim().toLowerCase()
    if (!q) return gifts
    return gifts.filter((g) => g.name.toLowerCase().includes(q) || String(g.diamonds).includes(q))
  }, [gifts, giftSearch])

  const { leftFns, rightFns } = useMemo(() => {
    const left: Func[] = []
    const right: Func[] = []
    for (const f of allFunctions) {
      if (tiles[f.id]?.side === "right") right.push(f)
      else left.push(f)
    }
    left.sort((a, b) => (tiles[a.id]?.order ?? 0) - (tiles[b.id]?.order ?? 0))
    right.sort((a, b) => (tiles[a.id]?.order ?? 0) - (tiles[b.id]?.order ?? 0))
    return { leftFns: left, rightFns: right }
  }, [allFunctions, tiles])

  const updateTile = (fid: string, patch: Partial<TileState>) => {
    setTiles((prev) => ({ ...prev, [fid]: { ...prev[fid], ...patch } }))
  }

  // Patch one gift (by index) on a tile — used by the preview drag and the
  // per-gift size sliders.
  const updateTileGift = (fid: string, index: number, patch: Partial<TileGift>) => {
    setTiles((prev) => {
      const cur = prev[fid]
      if (!cur || !cur.gifts[index]) return prev
      const gifts = cur.gifts.map((g, i) => (i === index ? { ...g, ...patch } : g))
      return { ...prev, [fid]: { ...cur, gifts } }
    })
  }

  // Picker click: gift already on the tile → remove it; otherwise append (up
  // to MAX_GIFTS), spawning at the next free corner so gifts never stack.
  const toggleTileGift = (fid: string, giftId: number) => {
    setTiles((prev) => {
      const cur = prev[fid]
      if (!cur) return prev
      const idx = cur.gifts.findIndex((g) => g.gift_id === giftId)
      let gifts: TileGift[]
      if (idx >= 0) {
        gifts = cur.gifts.filter((_, i) => i !== idx)
      } else {
        if (cur.gifts.length >= MAX_GIFTS) return prev
        const spawn = GIFT_SPAWN_POINTS[cur.gifts.length] ?? GIFT_SPAWN_POINTS[0]
        gifts = [...cur.gifts, { gift_id: giftId, scale: 0.32, x: spawn.x, y: spawn.y }]
      }
      return { ...prev, [fid]: { ...cur, gifts } }
    })
  }

  const removeTileGiftAt = (fid: string, index: number) => {
    setTiles((prev) => {
      const cur = prev[fid]
      if (!cur) return prev
      return { ...prev, [fid]: { ...cur, gifts: cur.gifts.filter((_, i) => i !== index) } }
    })
  }

  const toggleSide = (fid: string) => {
    setTiles((prev) => {
      const cur = prev[fid]
      const nextSide: Side = cur.side === "left" ? "right" : "left"
      const maxOrder = Math.max(
        -1,
        ...Object.values(prev)
          .filter((tt) => tt.side === nextSide)
          .map((tt) => tt.order),
      )
      return normalizeOrders({
        ...prev,
        [fid]: { ...cur, side: nextSide, order: maxOrder + 1 },
      })
    })
  }

  // Commit-on-drop approach. During drag we only track which tile sits under
  // the cursor — paint a strong "drop here" ring on it. On release we swap the
  // (side, order) of source ↔ target. State only changes once, so the active
  // motion.div drag gesture is never disturbed mid-flight.
  const dragSourceRef = useRef<string | null>(null)
  const hoverTargetRef = useRef<string | null>(null)
  const [hoverTargetId, setHoverTargetId] = useState<string | null>(null)

  const handleTileDragStart = (sourceId: string) => {
    dragSourceRef.current = sourceId
    hoverTargetRef.current = null
    setHoverTargetId(null)
  }

  const handleTileDrag = (sourceId: string, x: number, y: number) => {
    // Auto-scroll when the pointer is close to a viewport edge. Safe now that
    // the scroll listener compensates the dragged tile's y on every scroll
    // event — the tile stays glued to the cursor.
    const edge = 80
    const speed = 12
    if (y < edge) window.scrollBy(0, -speed)
    else if (y > window.innerHeight - edge) window.scrollBy(0, speed)

    const stack = document.elementsFromPoint(x, y)
    let targetId: string | null = null
    for (const el of stack) {
      const tileEl = (el as HTMLElement).closest("[data-tile-id]") as HTMLElement | null
      if (!tileEl) continue
      const id = tileEl.getAttribute("data-tile-id")
      if (id && id !== sourceId) {
        targetId = id
        break
      }
    }
    if (targetId === hoverTargetRef.current) return
    hoverTargetRef.current = targetId
    setHoverTargetId(targetId)
  }

  const handleTileDragEnd = () => {
    const sourceId = dragSourceRef.current
    const targetId = hoverTargetRef.current
    if (sourceId && targetId && sourceId !== targetId) {
      setTiles((prev) => {
        const src = prev[sourceId]
        const tgt = prev[targetId]
        if (!src || !tgt) return prev
        return normalizeOrders({
          ...prev,
          [sourceId]: { ...src, side: tgt.side, order: tgt.order },
          [targetId]: { ...tgt, side: src.side, order: src.order },
        })
      })
    }
    dragSourceRef.current = null
    hoverTargetRef.current = null
    setHoverTargetId(null)
  }

  const moveTile = (fid: string, direction: -1 | 1) => {
    setTiles((prev) => {
      const cur = prev[fid]
      const sameSide = Object.entries(prev)
        .filter(([, tt]) => tt.side === cur.side)
        .sort(([, a], [, b]) => a.order - b.order)
      const idx = sameSide.findIndex(([id]) => id === fid)
      const swapIdx = idx + direction
      if (swapIdx < 0 || swapIdx >= sameSide.length) return prev
      const [swapId, swapTile] = sameSide[swapIdx]
      return {
        ...prev,
        [fid]: { ...cur, order: swapTile.order },
        [swapId]: { ...swapTile, order: cur.order },
      }
    })
  }

  // Spawn a new custom card based on a chosen product_function's character.
  // Drops it at the end of the shorter side so the grid stays balanced.
  const addCustomTile = (source: Func) => {
    const id = `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
    const newFunc: Func = {
      id,
      name: `${source.name} +`,
      label_th: null,
      label_en: null,
      image_url: source.image_url,
      default_gift_id: null,
      default_trigger_threshold: null,
      source_function_id: source.id,
    }
    setCustomFuncs((prev) => [...prev, newFunc])
    setTiles((prev) => {
      const leftCount = Object.values(prev).filter((t) => t.side === "left").length
      const rightCount = Object.values(prev).filter((t) => t.side === "right").length
      const side: Side = leftCount <= rightCount ? "left" : "right"
      const order = side === "left" ? leftCount : rightCount
      return {
        ...prev,
        [id]: {
          gifts: [],
          label: "",
          label_size: 32,
          label_color: "auto",
          label_x: 0.96,
          label_y: 0.94,
          label_font: "default",
          label_stroke_color: "#000000",
          label_stroke_width: 0.08,
          character_image: source.image_url,
          character_scale: 1,
          character_y: 0,
          side,
          order,
        },
      }
    })
    setAddCardPickerOpen(false)
  }

  // Custom tiles are deleted outright (their data is user-generated and not
  // recoverable). Real product_function tiles are hidden via a set instead so
  // un-hiding restores the user's per-tile customizations.
  const removeTile = (id: string) => {
    if (id.startsWith("custom_")) {
      setCustomFuncs((prev) => prev.filter((f) => f.id !== id))
      setTiles((prev) => {
        const next = { ...prev }
        delete next[id]
        return normalizeOrders(next)
      })
    } else {
      setHiddenIds((prev) => {
        const next = new Set(prev)
        next.add(id)
        return next
      })
      // Re-normalize so the column the original lived in doesn't get a gap.
      setTiles((prev) => normalizeOrders({ ...prev }))
    }
    if (editingFunctionId === id) setEditingFunctionId(null)
  }

  const unhideFunction = (id: string) => {
    setHiddenIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    setAddCardPickerOpen(false)
  }

  const handleSave = async () => {
    // Public mode without login: bounce to login with callbackUrl so the user
    // lands right back on the builder with their work intact (unsaved local
    // state will reload from draft after login since they'll be authed).
    if (mode === "public" && !isAuthenticated) {
      const callback = encodeURIComponent(`/${locale}/livegen/${productId}`)
      window.location.href = `/${locale}/login?callbackUrl=${callback}`
      return
    }
    setSaving(true)
    try {
      const payload = {
        tiles: allFunctions
          .filter((f) => {
            const tt = tiles[f.id]
            if (!tt) return false
            // Custom tiles must also carry a source_function_id; otherwise the
            // server filter drops them silently and we'd lose the card.
            if (f.id.startsWith("custom_") && !f.source_function_id) return false
            return true
          })
          .map((f) => {
            const tt = tiles[f.id]!
            const isCustom = f.id.startsWith("custom_")
            return {
              function_id: f.id,
              ...(isCustom && { name: f.name, source_function_id: f.source_function_id }),
              gifts: tt?.gifts ?? [],
              // Legacy mirror of the first gift so a rollback to the
              // single-gift client still renders something sensible.
              gift_id: tt?.gifts[0]?.gift_id ?? null,
            label: tt?.label ?? "",
            side: tt?.side ?? "left",
            order: tt?.order ?? 0,
            gift_scale: tt?.gifts[0]?.scale ?? 0.32,
            gift_x: tt?.gifts[0]?.x ?? 0.03,
            gift_y: tt?.gifts[0]?.y ?? 0.03,
            label_size: tt?.label_size ?? 32,
            label_color: tt?.label_color ?? "auto",
            label_x: tt?.label_x ?? 0.96,
            label_y: tt?.label_y ?? 0.94,
            label_font: tt?.label_font ?? "default",
            label_stroke_color: tt?.label_stroke_color ?? "#000000",
            label_stroke_width: tt?.label_stroke_width ?? 0.08,
            character_image: tt?.character_image ?? null,
            character_scale: tt?.character_scale ?? 1,
            character_y: tt?.character_y ?? 0,
          }
        }),
        layout,
        hidden_function_ids: Array.from(hiddenIds),
      }
      const endpoint =
        mode === "order"
          ? `/api/orders/${orderId}/livegen`
          : `/api/livegen/drafts/${productId}`
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error("save failed")
      setSavedAt(new Date())
    } catch (e) {
      console.error(e)
      alert(t("save_error"))
    } finally {
      setSaving(false)
    }
  }

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const dpr = 2
      const tileW = layout.tile_width
      const tileH = Math.round(tileW * layout.tile_aspect)
      const w = (tileW * 2 + layout.column_gap + layout.padding * 2) * dpr
      const colHeight = (cnt: number) => tileH * cnt + layout.row_gap * Math.max(0, cnt - 1)
      const maxColH = Math.max(
        colHeight(leftFns.length) + Math.abs(layout.left_y_offset),
        colHeight(rightFns.length) + Math.abs(layout.right_y_offset),
      )
      const h = (maxColH + layout.padding * 2) * dpr

      const canvas = document.createElement("canvas")
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("no ctx")
      ctx.scale(dpr, dpr)
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = "high"

      if (layout.bg_color && layout.bg_color !== "transparent") {
        ctx.fillStyle = layout.bg_color
        ctx.fillRect(0, 0, w / dpr, h / dpr)
      } else {
        ctx.clearRect(0, 0, w / dpr, h / dpr)
      }

      const drawColumn = async (cols: Func[], colIdx: 0 | 1, yOffset: number) => {
        for (let i = 0; i < cols.length; i++) {
          const f = cols[i]
          const tile = tiles[f.id]
          if (!tile) continue  // defensive: skip any func without a tile state
          const x = layout.padding + colIdx * (tileW + layout.column_gap)
          const y = layout.padding + yOffset + i * (tileH + layout.row_gap)

          const charUrl = tile.character_image || f.image_url
          if (charUrl) {
            try {
              const img = await loadImage(getImageUrl(charUrl))
              const ar = img.width / img.height
              const tileAR = tileW / tileH
              let baseDw = tileW
              let baseDh = tileH
              if (ar > tileAR) baseDh = tileW / ar
              else baseDw = tileH * ar
              const dw = baseDw * tile.character_scale
              const dh = baseDh * tile.character_scale
              const dx = x + (tileW - dw) / 2
              const dy = y + (tileH - dh) / 2 + tile.character_y
              ctx.drawImage(img, dx, dy, dw, dh)
            } catch { /* skip */ }
          }

          for (const tg of tile.gifts) {
            const g = giftById.get(tg.gift_id)
            if (!g?.image_url) continue
            try {
              const img = await loadImage(getImageUrl(g.image_url))
              const size = Math.round(tileW * tg.scale)
              const gx = x + tg.x * tileW
              const gy = y + tg.y * tileH
              ctx.drawImage(img, gx, gy, size, size)
            } catch { /* skip */ }
          }

          const label = tile.label?.trim()
          if (label) {
            const fontOpt = FONT_OPTIONS.find((o) => o.key === tile.label_font || o.family === tile.label_font)
            const family = fontOpt?.family
              ? `"${fontOpt.family}", system-ui, sans-serif`
              : `system-ui, -apple-system, "Segoe UI", sans-serif`
            if (fontOpt?.family) {
              try { await document.fonts.load(`700 ${tile.label_size}px "${fontOpt.family}"`) } catch { /* ignore */ }
            }
            ctx.font = `700 ${tile.label_size}px ${family}`
            ctx.textAlign = "right"
            ctx.textBaseline = "alphabetic"
            // Match preview WebkitTextStroke proportionally so canvas output
            // and on-screen rendering stay visually consistent.
            ctx.lineWidth = Math.max(1, tile.label_size * tile.label_stroke_width * 2)
            ctx.lineJoin = "round"
            ctx.strokeStyle = tile.label_stroke_color || "#000000"
            ctx.fillStyle = resolveLabelColor(tile)
            const lx = x + tile.label_x * tileW
            const ly = y + tile.label_y * tileH
            ctx.strokeText(label, lx, ly)
            ctx.fillText(label, lx, ly)
          }
        }
      }

      await drawColumn(leftFns, 0, layout.left_y_offset)
      await drawColumn(rightFns, 1, layout.right_y_offset)

      canvas.toBlob((blob) => {
        if (!blob) return
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        const idForName = (orderId || productId || "image").slice(0, 8)
        a.download = `livegen-${idForName}.png`
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
      }, "image/png")
    } catch (e) {
      console.error(e)
      alert(t("download_error"))
    } finally {
      setDownloading(false)
    }
  }

  const openEditor = (fid: string) => {
    setGiftSearch("")
    setCharPickerOpen(false)
    setEditingFunctionId(fid)
  }

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 md:py-10">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <Link
            href={mode === "order" ? `/orders/${orderId}` : `/livegen`}
            className="text-[12px] text-text-muted hover:text-text-base inline-flex items-center gap-1.5 mb-1.5"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            {mode === "order" ? t("back_to_order") : t("back_to_picker")}
          </Link>
          <h1 className="text-xl md:text-2xl font-bold text-text-base">{t("title")}</h1>
          <p className="text-text-muted text-[12px] mt-0.5">{productName}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1.5 rounded-lg bg-bg-card border border-accent/20 text-text-base text-[12px] font-medium hover:border-accent/40 disabled:opacity-50 transition"
              title={mode === "public" && !isAuthenticated ? t("login_to_save_hint") : undefined}
            >
              {saving
                ? t("saving")
                : mode === "public" && !isAuthenticated
                  ? t("login_to_save")
                  : t("save")}
            </button>
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="px-3 py-1.5 rounded-lg bg-accent text-white text-[12px] font-medium hover:opacity-90 disabled:opacity-50 transition inline-flex items-center gap-1.5"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {downloading ? t("downloading") : t("download_png")}
            </button>
          </div>
          {savedAt && <p className="text-[11px] text-green-400">{t("saved_just_now")}</p>}
        </div>
      </div>

      {/* Layout settings */}
      <div className="bg-bg-card border border-accent/10 rounded-xl mb-4 overflow-hidden">
        <button
          onClick={() => setLayoutOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-white/[0.02] transition"
        >
          <div className="flex items-center gap-2.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent-light">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            <div className="text-left">
              <p className="text-[12px] font-bold text-text-base">{t("layout_settings")}</p>
              <p className="text-[10px] text-text-muted">{t("layout_settings_sub")}</p>
            </div>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`text-text-muted transition-transform ${layoutOpen ? "rotate-180" : ""}`}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        {layoutOpen && (
          <div className="px-4 pb-4 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2.5 border-t border-white/5">
            <Slider label={t("column_gap")} value={layout.column_gap} min={0} max={300} step={2} format={(v) => `${v}px`} onChange={(v) => updateLayout({ column_gap: v })} />
            <Slider label={t("row_gap")} value={layout.row_gap} min={0} max={150} step={2} format={(v) => `${v}px`} onChange={(v) => updateLayout({ row_gap: v })} />
            <Slider label={t("left_y_offset")} value={layout.left_y_offset} min={-300} max={300} step={4} format={(v) => `${v}px`} onChange={(v) => updateLayout({ left_y_offset: v })} />
            <Slider label={t("right_y_offset")} value={layout.right_y_offset} min={-300} max={300} step={4} format={(v) => `${v}px`} onChange={(v) => updateLayout({ right_y_offset: v })} />
            <Slider label={t("tile_width")} value={layout.tile_width} min={150} max={500} step={10} format={(v) => `${v}px`} onChange={(v) => updateLayout({ tile_width: v })} />
            <Slider label={t("tile_aspect")} value={layout.tile_aspect} min={0.6} max={2} step={0.05} format={(v) => v.toFixed(2)} onChange={(v) => updateLayout({ tile_aspect: v })} />
            <Slider label={t("outer_padding")} value={layout.padding} min={0} max={150} step={2} format={(v) => `${v}px`} onChange={(v) => updateLayout({ padding: v })} />
            <div>
              <p className="text-[10px] text-text-muted mb-1">{t("bg_color")}</p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => updateLayout({ bg_color: "transparent" })}
                  className={`px-2 py-0.5 rounded-md text-[10px] border ${layout.bg_color === "transparent" ? "border-accent text-accent-light bg-accent/10" : "border-white/10 text-text-muted"}`}
                >
                  {t("transparent")}
                </button>
                {["#000000", "#0a0a0f", "#ffffff", "#1f2937"].map((c) => (
                  <button
                    key={c}
                    onClick={() => updateLayout({ bg_color: c })}
                    className={`w-6 h-6 rounded-md border-2 ${layout.bg_color === c ? "border-accent ring-2 ring-accent/30" : "border-white/10"}`}
                    style={{ background: c }}
                  />
                ))}
                <input
                  type="color"
                  value={layout.bg_color.startsWith("#") ? layout.bg_color : "#000000"}
                  onChange={(e) => updateLayout({ bg_color: e.target.value })}
                  className="w-6 h-6 rounded-md border-2 border-white/10 cursor-pointer bg-transparent"
                />
              </div>
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <button
                onClick={() => setLayout(DEFAULT_LAYOUT)}
                className="text-[10px] text-text-muted hover:text-text-base"
              >
                {t("reset_layout")}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 mb-3 px-1">
        <p className="text-[10px] text-text-muted">{t("drag_tile_hint")}</p>
        {functions.length > 0 && (
          <button
            onClick={() => setAddCardPickerOpen(true)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent text-white text-[11px] font-bold hover:opacity-90 transition shrink-0"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            {t("add_card")}
          </button>
        )}
      </div>

      {allFunctions.length === 0 ? (
        <div className="bg-bg-card border border-accent/10 rounded-2xl p-10 text-center">
          <p className="text-text-muted">{t("no_functions")}</p>
        </div>
      ) : (
        <div
          className="rounded-2xl overflow-hidden mx-auto"
          style={{
            background: layout.bg_color === "transparent" ? undefined : layout.bg_color,
            padding: `${Math.min(layout.padding, 32)}px`,
            width: `${layout.tile_width * 2 + layout.column_gap + Math.min(layout.padding, 32) * 2}px`,
            maxWidth: "100%",
          }}
        >
          {/* Side headers, sitting above the tile grid in their own columns */}
          <div
            className="grid mb-2"
            style={{
              gridTemplateColumns: `${layout.tile_width}px ${layout.tile_width}px`,
              columnGap: `${layout.column_gap}px`,
            }}
          >
            <div className="flex items-center gap-2 px-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-green-400">{t("side_left")}</h2>
              <span className="text-[10px] text-text-muted ml-auto">{leftFns.length}</span>
            </div>
            <div className="flex items-center gap-2 px-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-red-400">{t("side_right")}</h2>
              <span className="text-[10px] text-text-muted ml-auto">{rightFns.length}</span>
            </div>
          </div>

          {/* Flat grid — every tile is a sibling positioned via gridColumn/Row.
              Changing tile.side or tile.order never changes the React parent,
              so motion.div instances survive cross-side swaps mid-drag. */}
          <LayoutGroup id="livegen-tiles">
            <div
              className="grid"
              style={{
                gridTemplateColumns: `${layout.tile_width}px ${layout.tile_width}px`,
                columnGap: `${layout.column_gap}px`,
                rowGap: `${Math.min(layout.row_gap, 40)}px`,
              }}
            >
              {allFunctions.map((f) => {
                const tt = tiles[f.id]
                if (!tt) return null
                return (
                  <DraggableTile
                    key={f.id}
                    f={f}
                    tile={tt}
                    aspect={layout.tile_aspect}
                    giftById={giftById}
                    resolveColor={resolveLabelColor}
                    gridColumn={tt.side === "left" ? 1 : 2}
                    gridRow={tt.order + 1}
                    isHoverTarget={hoverTargetId === f.id}
                    swapHere={t("swap_here")}
                    canRemove={true}
                    removeLabel={t("remove_card")}
                    onRemove={() => removeTile(f.id)}
                    onOpen={() => openEditor(f.id)}
                    onDragStart={handleTileDragStart}
                    onDragMove={handleTileDrag}
                    onDragEnd={handleTileDragEnd}
                    editLabel={t("edit")}
                    noImageLabel={t("no_image")}
                  />
                )
              })}
              {(leftFns.length === 0 || rightFns.length === 0) && (
                <div
                  className="border border-dashed border-white/10 rounded-2xl flex items-center justify-center text-[10px] text-text-muted p-4"
                  style={{
                    aspectRatio: `1 / ${layout.tile_aspect}`,
                    gridColumn: leftFns.length === 0 ? 1 : 2,
                    gridRow: 1,
                  }}
                >
                  {t("empty_side")}
                </div>
              )}
            </div>
          </LayoutGroup>
        </div>
      )}

      {/* Add-card picker modal */}
      {addCardPickerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3"
          onClick={() => setAddCardPickerOpen(false)}
        >
          <div
            className="w-full max-w-md bg-bg-card border border-accent/15 rounded-2xl overflow-hidden flex flex-col max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
              <div>
                <h2 className="text-[14px] font-bold text-text-base">{t("add_card_title")}</h2>
                <p className="text-[10px] text-text-muted">{t("add_card_sub")}</p>
              </div>
              <button
                onClick={() => setAddCardPickerOpen(false)}
                className="w-7 h-7 rounded-md hover:bg-white/5 text-text-muted hover:text-text-base flex items-center justify-center"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="p-4 overflow-y-auto">
              <div className="grid grid-cols-3 gap-2">
                {functions.map((f) => {
                  const isHidden = hiddenIds.has(f.id)
                  return (
                    <button
                      key={f.id}
                      // Hidden originals un-hide on click (restoring saved
                      // tile state); visible ones spawn a custom duplicate.
                      onClick={() => (isHidden ? unhideFunction(f.id) : addCustomTile(f))}
                      className={`relative aspect-[7/9] rounded-xl border bg-bg-base overflow-hidden text-left group transition ${
                        isHidden
                          ? "border-accent/40 ring-1 ring-accent/30"
                          : "border-white/10 hover:border-accent/40"
                      }`}
                    >
                      {f.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={getImageUrl(f.image_url)}
                          alt={f.name}
                          className="absolute inset-0 w-full h-full object-contain p-1"
                        />
                      ) : (
                        <span className="absolute inset-0 flex items-center justify-center text-[10px] text-text-muted text-center px-2">
                          {f.name}
                        </span>
                      )}
                      {isHidden && (
                        <span className="absolute top-1 right-1 bg-accent text-white text-[9px] px-1.5 py-0.5 rounded font-bold">
                          {t("restore_badge")}
                        </span>
                      )}
                      <span className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[10px] text-center py-0.5 truncate">
                        {f.name}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit drawer */}
      {editing && editingTile && (() => {
        const sameSide = Object.entries(tiles)
          .filter(([, tt]) => tt.side === editingTile.side)
          .sort(([, a], [, b]) => a.order - b.order)
        const positionInCol = sameSide.findIndex(([id]) => id === editing.id)
        const isFirst = positionInCol === 0
        const isLast = positionInCol === sameSide.length - 1
        const previewCharUrl = editingTile.character_image || editing.image_url

        return (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-2 sm:p-4"
            onClick={() => setEditingFunctionId(null)}
          >
            <div
              className="w-full max-w-3xl bg-bg-card border border-accent/15 rounded-2xl overflow-hidden max-h-[95vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between sticky top-0 bg-bg-card z-10">
                <div>
                  <h2 className="text-[14px] font-bold text-text-base">{t("edit_tile")}</h2>
                  <p className="text-[10px] text-text-muted">{editing.name}</p>
                </div>
                <button
                  onClick={() => setEditingFunctionId(null)}
                  className="w-7 h-7 rounded-md hover:bg-white/5 text-text-muted hover:text-text-base flex items-center justify-center"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              <div className="overflow-y-auto grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-4 p-4">
                {/* Draggable mini preview */}
                <div className="sm:sticky sm:top-0 sm:self-start">
                  <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5">
                    {t("preview")}
                  </p>
                  <DraggablePreview
                    f={editing}
                    tile={editingTile}
                    aspect={layout.tile_aspect}
                    previewCharUrl={previewCharUrl}
                    giftById={giftById}
                    resolveColor={resolveLabelColor}
                    onGiftMove={(i, x, y) => updateTileGift(editing.id, i, { x, y })}
                    onLabelMove={(x, y) => updateTile(editing.id, { label_x: x, label_y: y })}
                  />
                  <p className="text-[9px] text-text-muted mt-1.5 leading-tight">{t("drag_hint")}</p>
                  <button
                    onClick={() => updateTile(editing.id, {
                      gifts: editingTile.gifts.map((g, i) => ({
                        ...g,
                        x: (GIFT_SPAWN_POINTS[i] ?? GIFT_SPAWN_POINTS[0]).x,
                        y: (GIFT_SPAWN_POINTS[i] ?? GIFT_SPAWN_POINTS[0]).y,
                      })),
                      label_x: 0.96, label_y: 0.94,
                    })}
                    className="text-[9px] text-text-muted hover:text-text-base mt-1 underline"
                  >
                    {t("reset_positions")}
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Position */}
                  <Section title={t("position")}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => toggleSide(editing.id)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition ${
                          editingTile.side === "left"
                            ? "bg-green-500/15 border-green-500/30 text-green-400 hover:bg-green-500/25"
                            : "bg-red-500/15 border-red-500/30 text-red-400 hover:bg-red-500/25"
                        }`}
                      >
                        {editingTile.side === "left" ? t("on_left") : t("on_right")} · {t("tap_to_swap")}
                      </button>
                      <div className="flex gap-1 ml-auto">
                        <IconBtn onClick={() => moveTile(editing.id, -1)} disabled={isFirst} title={t("move_up")}>
                          <polyline points="18 15 12 9 6 15" />
                        </IconBtn>
                        <IconBtn onClick={() => moveTile(editing.id, 1)} disabled={isLast} title={t("move_down")}>
                          <polyline points="6 9 12 15 18 9" />
                        </IconBtn>
                      </div>
                    </div>
                  </Section>

                  {/* Character */}
                  <Section title={t("character")}>
                    <button
                      onClick={() => setCharPickerOpen((v) => !v)}
                      className="w-full text-[11px] px-3 py-1.5 rounded-md bg-bg-base border border-white/10 hover:border-accent/30 text-left flex items-center justify-between"
                    >
                      <span className="text-text-muted">
                        {editingTile.character_image ? t("character_custom") : t("character_default")}
                      </span>
                      <span className="text-accent-light text-[10px]">{t("change")}</span>
                    </button>
                    {charPickerOpen && (
                      <div className="bg-bg-base border border-white/10 rounded-md p-2 mt-1.5 max-h-[24vh] overflow-y-auto">
                        <div className="grid grid-cols-5 gap-1.5">
                          <button
                            onClick={() => updateTile(editing.id, { character_image: null })}
                            className={`relative aspect-[7/9] rounded-md border ${
                              editingTile.character_image === null
                                ? "border-accent bg-accent/15"
                                : "border-white/10 hover:border-accent/30"
                            }`}
                          >
                            {editing.image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={getImageUrl(editing.image_url)} alt="" className="absolute inset-0 w-full h-full object-contain p-0.5" />
                            ) : (
                              <span className="absolute inset-0 flex items-center justify-center text-[8px] text-text-muted">
                                {t("none")}
                              </span>
                            )}
                            <span className="absolute bottom-0 left-0 right-0 text-[8px] text-center bg-black/60 text-white py-0.5">
                              {t("default")}
                            </span>
                          </button>
                          {characterLibrary
                            .filter((c) => c.url !== editing.image_url)
                            .map((c) => (
                              <button
                                key={c.url}
                                onClick={() => updateTile(editing.id, { character_image: c.url })}
                                className={`relative aspect-[7/9] rounded-md border ${
                                  editingTile.character_image === c.url
                                    ? "border-accent bg-accent/15"
                                    : "border-white/10 hover:border-accent/30"
                                }`}
                                title={c.name}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={getImageUrl(c.url)} alt="" className="absolute inset-0 w-full h-full object-contain p-0.5" />
                              </button>
                            ))}
                          {gifts
                            .filter((g) => g.image_url)
                            .slice(0, 60)
                            .map((g) => (
                              <button
                                key={`gift-${g.id}`}
                                onClick={() => updateTile(editing.id, { character_image: g.image_url })}
                                className={`relative aspect-[7/9] rounded-md border ${
                                  editingTile.character_image === g.image_url
                                    ? "border-accent bg-accent/15"
                                    : "border-white/10 hover:border-accent/30"
                                }`}
                                title={g.name}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={getImageUrl(g.image_url!)} alt="" className="absolute inset-0 w-full h-full object-contain p-0.5" />
                              </button>
                            ))}
                        </div>
                      </div>
                    )}
                    <Slider label={t("scale")} value={editingTile.character_scale} min={0.3} max={2} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => updateTile(editing.id, { character_scale: v })} />
                    <Slider label={t("vertical_offset")} value={editingTile.character_y} min={-200} max={200} step={4} format={(v) => `${v}px`} onChange={(v) => updateTile(editing.id, { character_y: v })} />
                  </Section>

                  {/* Label */}
                  <Section title={t("label_field")}>
                    <input
                      value={editingTile.label}
                      onChange={(e) => updateTile(editing.id, { label: e.target.value })}
                      placeholder={t("label_placeholder")}
                      maxLength={32}
                      className="w-full bg-bg-base border border-accent/15 rounded-md px-2.5 py-1.5 text-[13px] outline-none focus:border-accent/40"
                    />
                    <Slider label={t("font_size")} value={editingTile.label_size} min={14} max={80} step={1} format={(v) => `${v}px`} onChange={(v) => updateTile(editing.id, { label_size: v })} />
                    <div>
                      <p className="text-[10px] text-text-muted mb-1">{t("font_family")}</p>
                      <div className="grid grid-cols-2 gap-1">
                        {FONT_OPTIONS.map((fo) => {
                          const active = editingTile.label_font === fo.key
                          return (
                            <button
                              key={fo.key}
                              onClick={() => updateTile(editing.id, { label_font: fo.key })}
                              className={`px-2 py-1 rounded-md text-[11px] border transition text-left truncate ${
                                active
                                  ? "border-accent bg-accent/15 text-accent-light"
                                  : "border-white/10 bg-bg-base text-text-base hover:border-accent/30"
                              }`}
                              style={{ fontFamily: fo.family ? `"${fo.family}"` : undefined, fontWeight: 700 }}
                            >
                              {fo.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    {/* Stroke controls */}
                    <Slider
                      label={t("stroke_width")}
                      value={editingTile.label_stroke_width}
                      min={0}
                      max={0.3}
                      step={0.01}
                      format={(v) => `${Math.round(v * 100)}%`}
                      onChange={(v) => updateTile(editing.id, { label_stroke_width: v })}
                    />
                    <div>
                      <p className="text-[10px] text-text-muted mb-1">{t("stroke_color")}</p>
                      <div className="flex gap-1.5 flex-wrap">
                        {["#000000", "#ffffff", "#ef4444", "#3ecf8e", "#fbbf24", "#06b6d4", "#1f2937"].map((c) => {
                          const active = (editingTile.label_stroke_color || "#000000").toLowerCase() === c.toLowerCase()
                          return (
                            <button
                              key={c}
                              onClick={() => updateTile(editing.id, { label_stroke_color: c })}
                              className={`w-6 h-6 rounded-md border-2 ${active ? "border-accent ring-2 ring-accent/30" : "border-white/10"}`}
                              style={{ background: c }}
                              title={c}
                            />
                          )
                        })}
                        <input
                          type="color"
                          value={editingTile.label_stroke_color || "#000000"}
                          onChange={(e) => updateTile(editing.id, { label_stroke_color: e.target.value })}
                          className="w-6 h-6 rounded-md border-2 border-white/10 cursor-pointer bg-transparent"
                        />
                      </div>
                    </div>
                    <div className="flex gap-1 flex-wrap mt-1.5">
                      {COLOR_PRESETS.map((c) => {
                        const isAuto = c.key === "auto"
                        const selected =
                          (isAuto && editingTile.label_color === "auto") ||
                          (!isAuto && editingTile.label_color === c.hex)
                        return (
                          <button
                            key={c.key}
                            onClick={() => updateTile(editing.id, { label_color: isAuto ? "auto" : c.hex! })}
                            className={`w-6 h-6 rounded-md border-2 flex items-center justify-center text-[8px] ${
                              selected ? "border-accent ring-2 ring-accent/30" : "border-white/10"
                            }`}
                            style={isAuto ? undefined : { background: c.hex! }}
                            title={t(`color_${c.key}`)}
                          >
                            {isAuto && <span className="text-text-muted">A</span>}
                          </button>
                        )
                      })}
                      <input
                        type="color"
                        value={editingTile.label_color === "auto" || !editingTile.label_color.startsWith("#") ? "#ffffff" : editingTile.label_color}
                        onChange={(e) => updateTile(editing.id, { label_color: e.target.value })}
                        className="w-6 h-6 rounded-md border-2 border-white/10 cursor-pointer bg-transparent"
                        title={t("color_custom")}
                      />
                    </div>
                  </Section>

                  {/* Gifts — up to MAX_GIFTS per tile. Grid toggles add/remove;
                      each selected gift gets its own size slider below. */}
                  <Section title={`${t("gift_field")} (${editingTile.gifts.length}/${MAX_GIFTS})`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] text-text-muted">
                        {editingTile.gifts.length === 0
                          ? t("none")
                          : editingTile.gifts
                              .map((tg) => giftById.get(tg.gift_id)?.name)
                              .filter(Boolean)
                              .join(" · ")}
                      </span>
                      {editingTile.gifts.length > 0 && (
                        <button
                          onClick={() => updateTile(editing.id, { gifts: [] })}
                          className="text-[10px] text-red-400 hover:text-red-300"
                        >
                          {t("clear_gift")}
                        </button>
                      )}
                    </div>
                    <input
                      value={giftSearch}
                      onChange={(e) => setGiftSearch(e.target.value)}
                      placeholder={t("gift_search")}
                      className="w-full bg-bg-base border border-accent/15 rounded-md px-2.5 py-1 text-[11px] outline-none focus:border-accent/40 mb-1.5"
                    />
                    <div className="grid grid-cols-6 sm:grid-cols-8 gap-1 max-h-[22vh] overflow-y-auto pr-1">
                      {filteredGifts.map((g) => {
                        const selected = editingTile.gifts.some((tg) => tg.gift_id === g.id)
                        const full = !selected && editingTile.gifts.length >= MAX_GIFTS
                        return (
                          <button
                            key={g.id}
                            onClick={() => toggleTileGift(editing.id, g.id)}
                            disabled={full}
                            className={`relative aspect-square rounded-md border ${
                              selected
                                ? "border-accent bg-accent/15"
                                : full
                                  ? "border-white/5 bg-bg-base opacity-35 cursor-not-allowed"
                                  : "border-white/10 bg-bg-base hover:border-accent/30"
                            }`}
                            title={`${g.name} · ${g.diamonds}`}
                          >
                            {g.image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={getImageUrl(g.image_url)} alt={g.name} className="absolute inset-0.5 w-[calc(100%-4px)] h-[calc(100%-4px)] object-contain" />
                            ) : (
                              <span className="absolute inset-0 flex items-center justify-center text-[8px] text-text-muted px-0.5 text-center">
                                {g.name}
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                    {editingTile.gifts.map((tg, i) => {
                      const g = giftById.get(tg.gift_id)
                      return (
                        <div key={`${tg.gift_id}-${i}`} className="flex items-center gap-2">
                          <div className="w-7 h-7 shrink-0 rounded-md border border-white/10 bg-bg-base relative overflow-hidden">
                            {g?.image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={getImageUrl(g.image_url)} alt={g?.name ?? ""} className="absolute inset-0.5 w-[calc(100%-4px)] h-[calc(100%-4px)] object-contain" />
                            ) : null}
                          </div>
                          <div className="flex-1 min-w-0">
                            <Slider
                              label={`${t("gift_size")} · ${g?.name ?? "?"}`}
                              value={tg.scale}
                              min={0.1}
                              max={0.8}
                              step={0.02}
                              format={(v) => `${Math.round(v * 100)}%`}
                              onChange={(v) => updateTileGift(editing.id, i, { scale: v })}
                            />
                          </div>
                          <button
                            onClick={() => removeTileGiftAt(editing.id, i)}
                            className="w-5 h-5 shrink-0 rounded-md text-text-muted hover:text-red-400 hover:bg-white/5 flex items-center justify-center"
                            title={t("clear_gift")}
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        </div>
                      )
                    })}
                  </Section>
                </div>
              </div>

              <div className="px-4 py-2.5 border-t border-white/5 flex justify-end sticky bottom-0 bg-bg-card">
                <button
                  onClick={() => setEditingFunctionId(null)}
                  className="px-3 py-1.5 rounded-md bg-accent text-white text-[12px] font-medium hover:opacity-90 transition"
                >
                  {t("done")}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </main>
  )
}

// motion.div + custom drag — `layout` makes neighbours animate to their new
// slots as state updates during drag; `drag` lets the user pull the tile in 2D
// across columns. Click vs drag is split: handle starts drag, button area opens
// the editor.
function DraggableTile({
  f,
  tile,
  aspect,
  giftById,
  resolveColor,
  gridColumn,
  gridRow,
  isHoverTarget,
  swapHere,
  canRemove,
  removeLabel,
  onRemove,
  onOpen,
  onDragStart,
  onDragMove,
  onDragEnd,
  editLabel,
  noImageLabel,
}: {
  f: Func
  tile: TileState
  aspect: number
  giftById: Map<number, Gift>
  resolveColor: (t: TileState) => string
  gridColumn: number
  gridRow: number
  isHoverTarget: boolean
  swapHere: string
  canRemove: boolean
  removeLabel: string
  onRemove: () => void
  onOpen: () => void
  onDragStart: (id: string) => void
  onDragMove: (id: string, x: number, y: number) => void
  onDragEnd: (id: string) => void
  editLabel: string
  noImageLabel: string
}) {
  const dragX = useMotionValue(0)
  const dragY = useMotionValue(0)
  const [isDragging, setIsDragging] = useState(false)
  const charUrl = tile.character_image || f.image_url
  const fontOpt = FONT_OPTIONS.find((o) => o.key === tile.label_font)
  const fontFamily = fontOpt?.family ? `"${fontOpt.family}"` : undefined

  // Drag state held in a ref so the scroll listener can recompute position
  // from the most recent pointer coords without React re-renders.
  const dragStateRef = useRef<{
    pointerStartX: number
    pointerStartY: number
    scrollStart: number
    lastClientX: number
    lastClientY: number
    pointerId: number
  } | null>(null)

  const recompute = () => {
    const s = dragStateRef.current
    if (!s) return
    const dx = s.lastClientX - s.pointerStartX
    // Crucial: bake the scroll delta into y so the tile keeps tracking the
    // cursor even while the page scrolls underneath it (auto-scroll or wheel).
    const dy = (s.lastClientY - s.pointerStartY) + (window.scrollY - s.scrollStart)
    dragX.set(dx)
    dragY.set(dy)
  }

  useEffect(() => {
    const onScroll = () => recompute()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
    // recompute closes over dragX/dragY but those are stable refs from useMotionValue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    dragStateRef.current = {
      pointerStartX: e.clientX,
      pointerStartY: e.clientY,
      scrollStart: window.scrollY,
      lastClientX: e.clientX,
      lastClientY: e.clientY,
      pointerId: e.pointerId,
    }
    setIsDragging(true)
    onDragStart(f.id)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    const s = dragStateRef.current
    if (!s || s.pointerId !== e.pointerId) return
    s.lastClientX = e.clientX
    s.lastClientY = e.clientY
    recompute()
    onDragMove(f.id, e.clientX, e.clientY)
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    const s = dragStateRef.current
    if (!s || s.pointerId !== e.pointerId) return
    dragStateRef.current = null
    setIsDragging(false)
    onDragEnd(f.id)
    // Spring transform back to 0 so the tile lands in its grid slot.
    animate(dragX, 0, { type: "spring", stiffness: 500, damping: 38 })
    animate(dragY, 0, { type: "spring", stiffness: 500, damping: 38 })
  }

  return (
    <motion.div
      layout
      layoutId={f.id}
      data-tile-id={f.id}
      transition={{ layout: { duration: 0.18 } }}
      className={`relative bg-bg-card border-2 rounded-2xl overflow-hidden ${
        isHoverTarget ? "border-accent" : "border-accent/20 hover:border-accent/40"
      }`}
      style={{
        aspectRatio: `1 / ${aspect}`,
        gridColumn,
        gridRow,
        x: dragX,
        y: dragY,
        zIndex: isDragging ? 50 : undefined,
        opacity: isDragging ? 0.85 : 1,
      }}
    >
      <button
        type="button"
        onClick={onOpen}
        className="absolute inset-0 w-full h-full text-left bg-transparent"
        aria-label={editLabel}
      >
        {charUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={getImageUrl(charUrl)}
            alt={f.name}
            className="absolute inset-0 w-full h-full object-contain pointer-events-none"
            style={{
              transform: `translateY(${tile.character_y / 4}px) scale(${tile.character_scale})`,
              transformOrigin: "center",
            }}
            draggable={false}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-text-muted text-[11px]">
            {noImageLabel}
          </div>
        )}

        {tile.gifts.map((tg, i) => {
          const g = giftById.get(tg.gift_id)
          if (!g?.image_url) return null
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${tg.gift_id}-${i}`}
              src={getImageUrl(g.image_url)}
              alt={g.name}
              className="absolute object-contain drop-shadow-md pointer-events-none"
              style={{
                left: `${tg.x * 100}%`,
                top: `${tg.y * 100}%`,
                width: `${tg.scale * 100}%`,
                height: `${tg.scale * 100}%`,
              }}
              draggable={false}
            />
          )
        })}

        {tile?.label && (() => {
          const fs = Math.round(tile.label_size * 0.6)
          const strokeW = Math.max(0.5, fs * tile.label_stroke_width)
          return (
            <p
              className="absolute font-bold leading-none pointer-events-none whitespace-nowrap"
              style={{
                color: resolveColor(tile),
                fontSize: `${fs}px`,
                fontFamily,
                right: `${(1 - tile.label_x) * 100}%`,
                top: `${tile.label_y * 100}%`,
                transform: "translateY(-100%)",
                WebkitTextStroke: `${strokeW}px ${tile.label_stroke_color || "#000"}`,
                paintOrder: "stroke fill",
              }}
            >
              {tile.label}
            </p>
          )
        })()}
      </button>

      {/* Drop-here tag — just a small pill in the corner, no overlay tint or
          blur. The accent border on the tile already says "I'm the target". */}
      {isHoverTarget && (
        <div className="absolute top-1.5 right-1.5 z-20 bg-accent text-white text-[10px] font-bold px-2 py-0.5 rounded-md pointer-events-none">
          {swapHere}
        </div>
      )}

      {/* Remove button — visible on every tile. Real cards get hidden via a
          set so un-hiding via the picker restores their per-tile settings;
          custom cards are deleted outright by the caller. */}
      {canRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="absolute top-1.5 right-1.5 z-20 bg-red-500/85 hover:bg-red-500 text-white rounded-md p-1"
          title={removeLabel}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}

      {/* Drag handle */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="absolute top-1.5 left-1.5 z-10 bg-black/55 hover:bg-black/75 text-white/85 rounded-md p-1 cursor-grab active:cursor-grabbing touch-none"
        title="drag"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="9" cy="5" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="9" cy="19" r="1" />
          <circle cx="15" cy="5" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="15" cy="19" r="1" />
        </svg>
      </div>
    </motion.div>
  )
}

// Mini preview where the user drags the gift and the label around.
// Pointer-event based — pointerCapture means moves keep firing even if the
// cursor leaves the element while dragging.
function DraggablePreview({
  f,
  tile,
  aspect,
  previewCharUrl,
  giftById,
  resolveColor,
  onGiftMove,
  onLabelMove,
}: {
  f: Func
  tile: TileState
  aspect: number
  previewCharUrl: string | null
  giftById: Map<number, Gift>
  resolveColor: (t: TileState) => string
  onGiftMove: (index: number, x: number, y: number) => void
  onLabelMove: (x: number, y: number) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  // Capture the offset from the item's anchor to where the pointer was first
  // pressed; on move we subtract it so the item stays under the cursor instead
  // of snapping its top-left to the pointer. `index` picks which gift.
  const dragRef = useRef<{
    kind: "gift" | "label" | null
    index: number
    offsetX: number
    offsetY: number
  }>({ kind: null, index: 0, offsetX: 0, offsetY: 0 })

  const handlePointerDown = (kind: "gift" | "label", index = 0) => (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const mx = (e.clientX - rect.left) / rect.width
    const my = (e.clientY - rect.top) / rect.height
    const anchorX = kind === "gift" ? tile.gifts[index]?.x ?? 0 : tile.label_x
    const anchorY = kind === "gift" ? tile.gifts[index]?.y ?? 0 : tile.label_y
    dragRef.current = { kind, index, offsetX: mx - anchorX, offsetY: my - anchorY }
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current.kind) return
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const mx = (e.clientX - rect.left) / rect.width
    const my = (e.clientY - rect.top) / rect.height
    const x = Math.min(1, Math.max(0, mx - dragRef.current.offsetX))
    const y = Math.min(1, Math.max(0, my - dragRef.current.offsetY))
    if (dragRef.current.kind === "gift") onGiftMove(dragRef.current.index, x, y)
    else onLabelMove(x, y)
  }

  const handlePointerUp = () => {
    dragRef.current.kind = null
  }

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="relative bg-bg-base border border-white/10 rounded-md overflow-hidden touch-none select-none"
      style={{ aspectRatio: `1 / ${aspect}` }}
    >
      {previewCharUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={getImageUrl(previewCharUrl)}
          alt=""
          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
          style={{ transform: `translateY(${tile.character_y / 4}px) scale(${tile.character_scale})` }}
          draggable={false}
        />
      ) : null}
      {tile.gifts.map((tg, i) => {
        const g = giftById.get(tg.gift_id)
        if (!g?.image_url) return null
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${tg.gift_id}-${i}`}
            src={getImageUrl(g.image_url)}
            alt=""
            className="absolute object-contain drop-shadow-md cursor-move"
            style={{
              left: `${tg.x * 100}%`,
              top: `${tg.y * 100}%`,
              width: `${tg.scale * 100}%`,
              height: `${tg.scale * 100}%`,
            }}
            draggable={false}
            onPointerDown={handlePointerDown("gift", i)}
          />
        )
      })}
      {tile.label && (() => {
        const fo = FONT_OPTIONS.find((o) => o.key === tile.label_font)
        const fs = Math.round(tile.label_size * 0.5)
        const strokeW = Math.max(0.4, fs * tile.label_stroke_width)
        return (
          <p
            className="absolute font-bold leading-none whitespace-nowrap cursor-move px-1"
            style={{
              color: resolveColor(tile),
              fontSize: `${fs}px`,
              fontFamily: fo?.family ? `"${fo.family}"` : undefined,
              right: `${(1 - tile.label_x) * 100}%`,
              top: `${tile.label_y * 100}%`,
              transform: "translateY(-100%)",
              WebkitTextStroke: `${strokeW}px ${tile.label_stroke_color || "#000"}`,
              paintOrder: "stroke fill",
            }}
            onPointerDown={handlePointerDown("label")}
          >
            {tile.label}
          </p>
        )
      })()}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[9px] text-text-muted uppercase tracking-wider mb-1.5 font-bold">{title}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  format: (v: number) => string
  onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="flex justify-between text-[10px] mb-0.5">
        <span className="text-text-muted">{label}</span>
        <span className="font-mono text-text-base">{format(value)}</span>
      </div>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-accent"
      />
    </div>
  )
}

function IconBtn({
  onClick,
  disabled,
  title,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  title?: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="w-7 h-7 rounded-md bg-bg-card border border-white/10 text-text-muted hover:text-text-base disabled:opacity-30 flex items-center justify-center"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        {children}
      </svg>
    </button>
  )
}
