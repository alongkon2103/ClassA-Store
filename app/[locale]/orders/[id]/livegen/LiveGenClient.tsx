"use client"

import { useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { Link } from "@/i18n/routing"
import { getImageUrl } from "@/lib/getImageUrl"

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
}

type CharacterLibraryItem = { url: string; name: string }

type Side = "left" | "right"
type GiftPos = "tl" | "tr" | "bl" | "br"

export type LiveGenConfig = {
  tiles: Array<{
    function_id: string
    gift_id: number | null
    label: string
    side?: Side
    order?: number
    gift_scale?: number
    gift_position?: GiftPos
    label_size?: number
    label_color?: string
    character_image?: string | null
    character_scale?: number
    character_y?: number
  }>
  layout?: Partial<LayoutState>
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
  column_gap: 16,
  row_gap: 16,
  padding: 24,
  left_y_offset: 0,
  right_y_offset: 0,
  tile_width: 280,
  tile_aspect: 9 / 7,
  bg_color: "transparent",
}

type Props = {
  orderId: string
  locale: string
  productName: string
  functions: Func[]
  gifts: Gift[]
  characterLibrary: CharacterLibraryItem[]
  initialConfig: LiveGenConfig | null
}

type TileState = {
  gift_id: number | null
  gift_scale: number
  gift_position: GiftPos
  label: string
  label_size: number
  label_color: string
  character_image: string | null
  character_scale: number
  character_y: number
  side: Side
  order: number
}

// Defaults retained for first-time tile seed only; actual layout comes from
// the LayoutState below so users can resize/respace the export interactively.

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

export default function LiveGenClient({
  orderId,
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
    const out: Record<string, TileState> = {}
    functions.forEach((f, i) => {
      const s = saved.get(f.id)
      out[f.id] = {
        gift_id: s?.gift_id ?? f.default_gift_id ?? null,
        gift_scale: s?.gift_scale ?? 0.32,
        gift_position: s?.gift_position ?? "tl",
        label: s?.label ?? (locale === "th" ? f.label_th : f.label_en) ?? "",
        label_size: s?.label_size ?? 36,
        label_color: s?.label_color ?? "auto",
        character_image: s?.character_image ?? null,
        character_scale: s?.character_scale ?? 1,
        character_y: s?.character_y ?? 0,
        side: s?.side ?? (i < half ? "left" : "right"),
        order: s?.order ?? i,
      }
    })
    return out
  }, [functions, initialConfig, locale])

  const [tiles, setTiles] = useState<Record<string, TileState>>(initialTiles)
  const [layout, setLayout] = useState<LayoutState>({
    ...DEFAULT_LAYOUT,
    ...(initialConfig?.layout ?? {}),
  })
  const [layoutOpen, setLayoutOpen] = useState(false)
  const [editingFunctionId, setEditingFunctionId] = useState<string | null>(null)
  const [giftSearch, setGiftSearch] = useState("")
  const [charPickerOpen, setCharPickerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)

  const updateLayout = (patch: Partial<LayoutState>) => setLayout((prev) => ({ ...prev, ...patch }))

  const editing = editingFunctionId ? functions.find((f) => f.id === editingFunctionId) : null
  const editingTile = editingFunctionId ? tiles[editingFunctionId] : null

  const filteredGifts = useMemo(() => {
    const q = giftSearch.trim().toLowerCase()
    if (!q) return gifts
    return gifts.filter((g) => g.name.toLowerCase().includes(q) || String(g.diamonds).includes(q))
  }, [gifts, giftSearch])

  const { leftFns, rightFns } = useMemo(() => {
    const left: Func[] = []
    const right: Func[] = []
    for (const f of functions) {
      if (tiles[f.id]?.side === "right") right.push(f)
      else left.push(f)
    }
    left.sort((a, b) => (tiles[a.id]?.order ?? 0) - (tiles[b.id]?.order ?? 0))
    right.sort((a, b) => (tiles[a.id]?.order ?? 0) - (tiles[b.id]?.order ?? 0))
    return { leftFns: left, rightFns: right }
  }, [functions, tiles])

  const updateTile = (fid: string, patch: Partial<TileState>) => {
    setTiles((prev) => ({ ...prev, [fid]: { ...prev[fid], ...patch } }))
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
      return { ...prev, [fid]: { ...cur, side: nextSide, order: maxOrder + 1 } }
    })
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

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = {
        tiles: functions.map((f) => {
          const tt = tiles[f.id]
          return {
            function_id: f.id,
            gift_id: tt?.gift_id ?? null,
            label: tt?.label ?? "",
            side: tt?.side ?? "left",
            order: tt?.order ?? 0,
            gift_scale: tt?.gift_scale ?? 0.32,
            gift_position: tt?.gift_position ?? "tl",
            label_size: tt?.label_size ?? 36,
            label_color: tt?.label_color ?? "auto",
            character_image: tt?.character_image ?? null,
            character_scale: tt?.character_scale ?? 1,
            character_y: tt?.character_y ?? 0,
          }
        }),
        layout,
      }
      const res = await fetch(`/api/orders/${orderId}/livegen`, {
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

  const giftCornerCoords = (
    pos: GiftPos,
    tileX: number,
    tileY: number,
    size: number,
    tileW: number,
    tileH: number,
  ) => {
    const m = 10
    switch (pos) {
      case "tr": return { x: tileX + tileW - size - m, y: tileY + m }
      case "bl": return { x: tileX + m, y: tileY + tileH - size - m }
      case "br": return { x: tileX + tileW - size - m, y: tileY + tileH - size - m }
      default:   return { x: tileX + m, y: tileY + m }
    }
  }

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const dpr = 2
      const tileW = layout.tile_width
      const tileH = Math.round(tileW * layout.tile_aspect)
      const rows = Math.max(leftFns.length, rightFns.length)
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

          if (tile.gift_id) {
            const g = giftById.get(tile.gift_id)
            if (g?.image_url) {
              try {
                const img = await loadImage(getImageUrl(g.image_url))
                const size = Math.round(tileW * tile.gift_scale)
                const { x: gx, y: gy } = giftCornerCoords(tile.gift_position, x, y, size, tileW, tileH)
                ctx.drawImage(img, gx, gy, size, size)
              } catch { /* skip */ }
            }
          }

          const label = tile.label?.trim()
          if (label) {
            ctx.font = `700 ${tile.label_size}px system-ui, -apple-system, "Segoe UI", sans-serif`
            ctx.textAlign = "right"
            ctx.textBaseline = "alphabetic"
            ctx.lineWidth = Math.max(3, tile.label_size * 0.1)
            ctx.strokeStyle = "rgba(0,0,0,0.85)"
            ctx.fillStyle = resolveLabelColor(tile)
            const lx = x + tileW - 12
            const ly = y + tileH - 14
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
        a.download = `livegen-${orderId.slice(0, 8)}.png`
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

  const giftCornerCss = (pos: GiftPos): string => {
    switch (pos) {
      case "tr": return "top-2 right-2"
      case "bl": return "bottom-2 left-2"
      case "br": return "bottom-2 right-2"
      default:   return "top-2 left-2"
    }
  }

  const renderTile = (f: Func) => {
    const tile = tiles[f.id]
    const gift = tile?.gift_id ? giftById.get(tile.gift_id) : null
    const charUrl = tile.character_image || f.image_url
    return (
      <button
        key={f.id}
        onClick={() => {
          setGiftSearch("")
          setCharPickerOpen(false)
          setEditingFunctionId(f.id)
        }}
        className="relative block w-full bg-bg-card border border-accent/15 rounded-2xl overflow-hidden text-left hover:border-accent/40 transition group"
        style={{ aspectRatio: `1 / ${layout.tile_aspect}` }}
      >
        {charUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={getImageUrl(charUrl)}
            alt={f.name}
            className="absolute inset-0 w-full h-full object-contain transition-transform"
            style={{
              transform: `translateY(${tile.character_y / 4}px) scale(${tile.character_scale})`,
              transformOrigin: "center",
            }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-text-muted text-[11px]">
            {t("no_image")}
          </div>
        )}

        {gift?.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={getImageUrl(gift.image_url)}
            alt={gift.name}
            className={`absolute object-contain drop-shadow-md ${giftCornerCss(tile.gift_position)}`}
            style={{
              width: `${tile.gift_scale * 100}%`,
              height: `${tile.gift_scale * 100}%`,
            }}
          />
        )}

        {tile?.label && (
          <p
            className="absolute bottom-2 right-3 font-bold leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)]"
            style={{
              color: resolveLabelColor(tile),
              fontSize: `${Math.round(tile.label_size * 0.7)}px`,
            }}
          >
            {tile.label}
          </p>
        )}

        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition bg-black/60 text-white text-[10px] px-2 py-1 rounded-full">
          {t("edit")}
        </div>
      </button>
    )
  }

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 md:py-12">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <Link
            href={`/orders/${orderId}`}
            className="text-[12px] text-text-muted hover:text-text-base inline-flex items-center gap-1.5 mb-2"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            {t("back_to_order")}
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold text-text-base">{t("title")}</h1>
          <p className="text-text-muted text-[13px] mt-1">{productName}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-bg-card border border-accent/20 text-text-base text-[13px] font-medium hover:border-accent/40 disabled:opacity-50 transition"
            >
              {saving ? t("saving") : t("save")}
            </button>
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="px-4 py-2 rounded-xl bg-accent text-white text-[13px] font-medium hover:opacity-90 disabled:opacity-50 transition inline-flex items-center gap-1.5"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
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

      {/* Layout settings panel */}
      <div className="bg-bg-card border border-accent/10 rounded-2xl mb-5 overflow-hidden">
        <button
          onClick={() => setLayoutOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-white/[0.02] transition"
        >
          <div className="flex items-center gap-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent-light">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            <div className="text-left">
              <p className="text-[13px] font-bold text-text-base">{t("layout_settings")}</p>
              <p className="text-[11px] text-text-muted">{t("layout_settings_sub")}</p>
            </div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`text-text-muted transition-transform ${layoutOpen ? "rotate-180" : ""}`}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        {layoutOpen && (
          <div className="px-5 pb-5 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-3 border-t border-white/5">
            <Slider
              label={t("column_gap")}
              value={layout.column_gap}
              min={0} max={300} step={2}
              format={(v) => `${v}px`}
              onChange={(v) => updateLayout({ column_gap: v })}
            />
            <Slider
              label={t("row_gap")}
              value={layout.row_gap}
              min={0} max={150} step={2}
              format={(v) => `${v}px`}
              onChange={(v) => updateLayout({ row_gap: v })}
            />
            <Slider
              label={t("left_y_offset")}
              value={layout.left_y_offset}
              min={-300} max={300} step={4}
              format={(v) => `${v}px`}
              onChange={(v) => updateLayout({ left_y_offset: v })}
            />
            <Slider
              label={t("right_y_offset")}
              value={layout.right_y_offset}
              min={-300} max={300} step={4}
              format={(v) => `${v}px`}
              onChange={(v) => updateLayout({ right_y_offset: v })}
            />
            <Slider
              label={t("tile_width")}
              value={layout.tile_width}
              min={150} max={500} step={10}
              format={(v) => `${v}px`}
              onChange={(v) => updateLayout({ tile_width: v })}
            />
            <Slider
              label={t("tile_aspect")}
              value={layout.tile_aspect}
              min={0.6} max={2} step={0.05}
              format={(v) => v.toFixed(2)}
              onChange={(v) => updateLayout({ tile_aspect: v })}
            />
            <Slider
              label={t("outer_padding")}
              value={layout.padding}
              min={0} max={150} step={2}
              format={(v) => `${v}px`}
              onChange={(v) => updateLayout({ padding: v })}
            />
            <div>
              <p className="text-[11px] text-text-muted mb-1.5">{t("bg_color")}</p>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => updateLayout({ bg_color: "transparent" })}
                  className={`px-2.5 py-1 rounded-lg text-[11px] border ${layout.bg_color === "transparent" ? "border-accent text-accent-light bg-accent/10" : "border-white/10 text-text-muted"}`}
                >
                  {t("transparent")}
                </button>
                {["#000000", "#0a0a0f", "#ffffff", "#1f2937"].map((c) => (
                  <button
                    key={c}
                    onClick={() => updateLayout({ bg_color: c })}
                    className={`w-7 h-7 rounded-lg border-2 ${layout.bg_color === c ? "border-accent ring-2 ring-accent/30" : "border-white/10"}`}
                    style={{ background: c }}
                  />
                ))}
                <input
                  type="color"
                  value={layout.bg_color.startsWith("#") ? layout.bg_color : "#000000"}
                  onChange={(e) => updateLayout({ bg_color: e.target.value })}
                  className="w-7 h-7 rounded-lg border-2 border-white/10 cursor-pointer bg-transparent"
                  title={t("color_custom")}
                />
              </div>
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <button
                onClick={() => setLayout(DEFAULT_LAYOUT)}
                className="text-[11px] text-text-muted hover:text-text-base"
              >
                {t("reset_layout")}
              </button>
            </div>
          </div>
        )}
      </div>

      {functions.length === 0 ? (
        <div className="bg-bg-card border border-accent/10 rounded-2xl p-10 text-center">
          <p className="text-text-muted">{t("no_functions")}</p>
        </div>
      ) : (
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: layout.bg_color === "transparent" ? undefined : layout.bg_color,
            padding: `${Math.min(layout.padding, 40)}px`,
          }}
        >
          <div
            className="grid grid-cols-2"
            style={{ columnGap: `${Math.min(layout.column_gap, 80)}px` }}
          >
            <div style={{ transform: `translateY(${Math.min(Math.max(layout.left_y_offset, -120), 120) / 4}px)` }}>
              <div className="flex items-center gap-2 mb-3 px-1">
                <span className="w-2 h-2 rounded-full bg-green-400"></span>
                <h2 className="text-[12px] font-bold uppercase tracking-wider text-green-400">
                  {t("side_left")}
                </h2>
                <span className="text-[11px] text-text-muted ml-auto">{leftFns.length}</span>
              </div>
              <div className="flex flex-col" style={{ rowGap: `${Math.min(layout.row_gap, 60)}px` }}>
                {leftFns.map((f) => renderTile(f))}
                {leftFns.length === 0 && (
                  <div className="aspect-[7/9] border border-dashed border-white/10 rounded-2xl flex items-center justify-center text-[11px] text-text-muted">
                    {t("empty_side")}
                  </div>
                )}
              </div>
            </div>

            <div style={{ transform: `translateY(${Math.min(Math.max(layout.right_y_offset, -120), 120) / 4}px)` }}>
              <div className="flex items-center gap-2 mb-3 px-1">
                <span className="w-2 h-2 rounded-full bg-red-400"></span>
                <h2 className="text-[12px] font-bold uppercase tracking-wider text-red-400">
                  {t("side_right")}
                </h2>
                <span className="text-[11px] text-text-muted ml-auto">{rightFns.length}</span>
              </div>
              <div className="flex flex-col" style={{ rowGap: `${Math.min(layout.row_gap, 60)}px` }}>
                {rightFns.map((f) => renderTile(f))}
                {rightFns.length === 0 && (
                  <div className="aspect-[7/9] border border-dashed border-white/10 rounded-2xl flex items-center justify-center text-[11px] text-text-muted">
                    {t("empty_side")}
                  </div>
                )}
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
              <div className="px-5 py-3.5 border-b border-white/5 flex items-center justify-between sticky top-0 bg-bg-card z-10">
                <div>
                  <h2 className="text-[15px] font-bold text-text-base">{t("edit_tile")}</h2>
                  <p className="text-[11px] text-text-muted">{editing.name}</p>
                </div>
                <button
                  onClick={() => setEditingFunctionId(null)}
                  className="w-8 h-8 rounded-lg hover:bg-white/5 text-text-muted hover:text-text-base flex items-center justify-center"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              <div className="overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-0 sm:gap-5 p-5">
                {/* Mini preview */}
                <div className="sm:sticky sm:top-0 sm:self-start">
                  <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2">{t("preview")}</p>
                  <div className="relative aspect-[7/9] bg-bg-base border border-white/10 rounded-xl overflow-hidden">
                    {previewCharUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={getImageUrl(previewCharUrl)}
                        alt=""
                        className="absolute inset-0 w-full h-full object-contain"
                        style={{
                          transform: `translateY(${editingTile.character_y / 4}px) scale(${editingTile.character_scale})`,
                        }}
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-text-muted text-[11px]">
                        {t("no_image")}
                      </div>
                    )}
                    {editingTile.gift_id && giftById.get(editingTile.gift_id)?.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={getImageUrl(giftById.get(editingTile.gift_id)!.image_url!)}
                        alt=""
                        className={`absolute object-contain drop-shadow-md ${giftCornerCss(editingTile.gift_position)}`}
                        style={{
                          width: `${editingTile.gift_scale * 100}%`,
                          height: `${editingTile.gift_scale * 100}%`,
                        }}
                      />
                    )}
                    {editingTile.label && (
                      <p
                        className="absolute bottom-2 right-3 font-bold leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)]"
                        style={{
                          color: resolveLabelColor(editingTile),
                          fontSize: `${Math.round(editingTile.label_size * 0.7)}px`,
                        }}
                      >
                        {editingTile.label}
                      </p>
                    )}
                  </div>
                </div>

                {/* Controls */}
                <div className="space-y-5 mt-5 sm:mt-0">
                  {/* Position */}
                  <Section title={t("position")}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => toggleSide(editing.id)}
                        className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border transition ${
                          editingTile.side === "left"
                            ? "bg-green-500/15 border-green-500/30 text-green-400"
                            : "bg-red-500/15 border-red-500/30 text-red-400"
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
                      className="w-full text-[12px] px-3 py-2 rounded-lg bg-bg-base border border-white/10 hover:border-accent/30 text-left flex items-center justify-between"
                    >
                      <span className="text-text-muted">
                        {editingTile.character_image ? t("character_custom") : t("character_default")}
                      </span>
                      <span className="text-accent-light text-[11px]">{t("change")}</span>
                    </button>
                    {charPickerOpen && (
                      <div className="bg-bg-base border border-white/10 rounded-xl p-2 mt-2 max-h-[28vh] overflow-y-auto">
                        <div className="grid grid-cols-4 gap-2">
                          <button
                            onClick={() => updateTile(editing.id, { character_image: null })}
                            className={`relative aspect-[7/9] rounded-lg border ${
                              editingTile.character_image === null
                                ? "border-accent bg-accent/15"
                                : "border-white/10 hover:border-accent/30"
                            }`}
                          >
                            {editing.image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={getImageUrl(editing.image_url)} alt="" className="absolute inset-0 w-full h-full object-contain p-1" />
                            ) : (
                              <span className="absolute inset-0 flex items-center justify-center text-[9px] text-text-muted">
                                {t("none")}
                              </span>
                            )}
                            <span className="absolute bottom-0 left-0 right-0 text-[9px] text-center bg-black/60 text-white py-0.5">
                              {t("default")}
                            </span>
                          </button>
                          {characterLibrary
                            .filter((c) => c.url !== editing.image_url)
                            .map((c) => (
                              <button
                                key={c.url}
                                onClick={() => updateTile(editing.id, { character_image: c.url })}
                                className={`relative aspect-[7/9] rounded-lg border ${
                                  editingTile.character_image === c.url
                                    ? "border-accent bg-accent/15"
                                    : "border-white/10 hover:border-accent/30"
                                }`}
                                title={c.name}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={getImageUrl(c.url)} alt="" className="absolute inset-0 w-full h-full object-contain p-1" />
                              </button>
                            ))}
                          {gifts
                            .filter((g) => g.image_url)
                            .slice(0, 60)
                            .map((g) => (
                              <button
                                key={`gift-${g.id}`}
                                onClick={() => updateTile(editing.id, { character_image: g.image_url })}
                                className={`relative aspect-[7/9] rounded-lg border ${
                                  editingTile.character_image === g.image_url
                                    ? "border-accent bg-accent/15"
                                    : "border-white/10 hover:border-accent/30"
                                }`}
                                title={g.name}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={getImageUrl(g.image_url!)} alt="" className="absolute inset-0 w-full h-full object-contain p-1" />
                              </button>
                            ))}
                        </div>
                      </div>
                    )}
                    <Slider
                      label={t("scale")}
                      value={editingTile.character_scale}
                      min={0.3}
                      max={2}
                      step={0.05}
                      format={(v) => `${Math.round(v * 100)}%`}
                      onChange={(v) => updateTile(editing.id, { character_scale: v })}
                    />
                    <Slider
                      label={t("vertical_offset")}
                      value={editingTile.character_y}
                      min={-200}
                      max={200}
                      step={4}
                      format={(v) => `${v}px`}
                      onChange={(v) => updateTile(editing.id, { character_y: v })}
                    />
                  </Section>

                  {/* Label */}
                  <Section title={t("label_field")}>
                    <input
                      value={editingTile.label}
                      onChange={(e) => updateTile(editing.id, { label: e.target.value })}
                      placeholder={t("label_placeholder")}
                      maxLength={32}
                      className="w-full bg-bg-base border border-accent/15 rounded-xl px-3 py-2 text-[14px] outline-none focus:border-accent/40"
                    />
                    <Slider
                      label={t("font_size")}
                      value={editingTile.label_size}
                      min={14}
                      max={80}
                      step={1}
                      format={(v) => `${v}px`}
                      onChange={(v) => updateTile(editing.id, { label_size: v })}
                    />
                    <div className="flex gap-1.5 flex-wrap mt-2">
                      {COLOR_PRESETS.map((c) => {
                        const isAuto = c.key === "auto"
                        const selected =
                          (isAuto && editingTile.label_color === "auto") ||
                          (!isAuto && editingTile.label_color === c.hex)
                        return (
                          <button
                            key={c.key}
                            onClick={() => updateTile(editing.id, { label_color: isAuto ? "auto" : c.hex! })}
                            className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center text-[9px] ${
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
                        value={
                          editingTile.label_color === "auto" || !editingTile.label_color.startsWith("#")
                            ? "#ffffff"
                            : editingTile.label_color
                        }
                        onChange={(e) => updateTile(editing.id, { label_color: e.target.value })}
                        className="w-7 h-7 rounded-lg border-2 border-white/10 cursor-pointer bg-transparent"
                        title={t("color_custom")}
                      />
                    </div>
                  </Section>

                  {/* Gift */}
                  <Section title={t("gift_field")}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] text-text-muted">
                        {editingTile.gift_id ? giftById.get(editingTile.gift_id)?.name : t("none")}
                      </span>
                      {editingTile.gift_id !== null && (
                        <button
                          onClick={() => updateTile(editing.id, { gift_id: null })}
                          className="text-[11px] text-red-400 hover:text-red-300"
                        >
                          {t("clear_gift")}
                        </button>
                      )}
                    </div>
                    <input
                      value={giftSearch}
                      onChange={(e) => setGiftSearch(e.target.value)}
                      placeholder={t("gift_search")}
                      className="w-full bg-bg-base border border-accent/15 rounded-xl px-3 py-1.5 text-[12px] outline-none focus:border-accent/40 mb-2"
                    />
                    <div className="grid grid-cols-5 sm:grid-cols-6 gap-1.5 max-h-[26vh] overflow-y-auto pr-1">
                      {filteredGifts.map((g) => {
                        const selected = editingTile.gift_id === g.id
                        return (
                          <button
                            key={g.id}
                            onClick={() => updateTile(editing.id, { gift_id: g.id })}
                            className={`relative aspect-square rounded-lg border ${
                              selected
                                ? "border-accent bg-accent/15"
                                : "border-white/10 bg-bg-base hover:border-accent/30"
                            }`}
                            title={`${g.name} · ${g.diamonds}`}
                          >
                            {g.image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={getImageUrl(g.image_url)} alt={g.name} className="absolute inset-0.5 w-[calc(100%-4px)] h-[calc(100%-4px)] object-contain" />
                            ) : (
                              <span className="absolute inset-0 flex items-center justify-center text-[9px] text-text-muted px-1 text-center">
                                {g.name}
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                    <Slider
                      label={t("gift_size")}
                      value={editingTile.gift_scale}
                      min={0.1}
                      max={0.8}
                      step={0.02}
                      format={(v) => `${Math.round(v * 100)}%`}
                      onChange={(v) => updateTile(editing.id, { gift_scale: v })}
                    />
                    <div className="mt-2">
                      <p className="text-[11px] text-text-muted mb-1.5">{t("gift_corner")}</p>
                      <div className="grid grid-cols-2 gap-1.5 max-w-[140px]">
                        {(["tl", "tr", "bl", "br"] as GiftPos[]).map((pos) => (
                          <button
                            key={pos}
                            onClick={() => updateTile(editing.id, { gift_position: pos })}
                            className={`relative aspect-square rounded-lg border-2 ${
                              editingTile.gift_position === pos
                                ? "border-accent bg-accent/15"
                                : "border-white/10 bg-bg-base hover:border-accent/30"
                            }`}
                          >
                            <span
                              className={`absolute w-2 h-2 rounded-sm bg-accent-light ${
                                pos === "tl" ? "top-1 left-1" :
                                pos === "tr" ? "top-1 right-1" :
                                pos === "bl" ? "bottom-1 left-1" :
                                "bottom-1 right-1"
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  </Section>
                </div>
              </div>

              <div className="px-5 py-3 border-t border-white/5 flex justify-end sticky bottom-0 bg-bg-card">
                <button
                  onClick={() => setEditingFunctionId(null)}
                  className="px-4 py-2 rounded-xl bg-accent text-white text-[13px] font-medium hover:opacity-90 transition"
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2 font-bold">{title}</p>
      <div className="space-y-2">{children}</div>
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
      <div className="flex justify-between text-[11px] mb-0.5">
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
      className="w-8 h-8 rounded-lg bg-bg-card border border-white/10 text-text-muted hover:text-text-base disabled:opacity-30 flex items-center justify-center"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        {children}
      </svg>
    </button>
  )
}
