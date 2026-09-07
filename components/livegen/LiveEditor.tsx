"use client"

// สร้างรูปไลฟ์ — editor แบบ Canva ตาม designer.html
// engine = Fabric.js (โหลดฝั่ง client เท่านั้น) · ขนาดจริงของ canvas 1080×1920 / 1920×1080
// แสดงผลย่อลงตาม design (320×568) แล้วคูณด้วยซูม · ดาวน์โหลด = เรนเดอร์ขนาดจริง
//
// โครง: toolbar บน (ชื่อโปรเจค/บันทึก/ดาวน์โหลด) · แถบแท็บ 56px · แผง 260px · พื้นที่ canvas
// ประวัติ undo/redo เก็บเป็น JSON ของทั้ง canvas (สูงสุด 60 ขั้น)
// autosave: ล็อกอินแล้ว + มีของบน canvas → บันทึกอัตโนมัติ 2 วิหลังแก้ล่าสุด
import { useCallback, useEffect, useRef, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { useRouter } from "@/i18n/routing"
import type { Canvas, FabricObject } from "fabric"
import { FONT_LINK_HREF, DEFAULT_FONT, ensureFont, fontWeightFor } from "@/lib/livegen/fonts"
import { BACKGROUNDS, type BgPreset } from "@/lib/livegen/backgrounds"
import { getImageUrl } from "@/lib/getImageUrl"
import { attachSmartGuides } from "@/lib/livegen/guides"
import { splitSides } from "@/lib/livegen/templateLayout"
import { TemplatesPanel, TextPanel, ImagesPanel, GiftsPanel, ProjectsPanel } from "./panels"
import SelectionBar from "./SelectionBar"
import { CANVAS_SIZES, type Asset, type Game, type Gift, type Orientation, type PanelKey, type ProjectSummary, type SelectionInfo, type TextKind } from "./types"

type FabricNS = typeof import("fabric")
// วัตถุของเราแนบ data ไว้บอกบทบาท (เช่น พื้นหลัง) — Fabric ยอมให้ใส่ prop เพิ่มได้
type Obj = FabricObject & { data?: { role?: string; preset?: string } }

const HISTORY_MAX = 60

// รูปจากโดเมนอื่นต้องผ่าน /api/livegen/img ไม่งั้น canvas โดน taint แล้วดาวน์โหลดไม่ได้
function canvasSafeUrl(url: string) {
  const full = getImageUrl(url)
  if (typeof window === "undefined" || !/^https?:\/\//.test(full)) return full
  try {
    const u = new URL(full)
    if (u.origin === window.location.origin) return full
    if (process.env.NEXT_PUBLIC_BASE_URL_IMG && full.startsWith(process.env.NEXT_PUBLIC_BASE_URL_IMG)) return full // โฮสต์รูปของเราเอง (ตั้ง CORS ไว้แล้ว)
    return `/api/livegen/img?u=${encodeURIComponent(full)}`
  } catch { return full }
}
const TABS: PanelKey[] = ["templates", "text", "images", "gifts", "projects"]

// ขนาดแสดงผลตาม design: 320×568 · ≤1024 → 280 · ≤768 → 220
function baseShort(vw: number) {
  return vw <= 768 ? 220 : vw <= 1024 ? 280 : 320
}

const TAB_ICONS: Record<PanelKey, React.ReactNode> = {
  templates: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" /></svg>,
  text: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 7 4 4 20 4 20 7" /><line x1="9.5" y1="20" x2="14.5" y2="20" /><line x1="12" y1="4" x2="12" y2="20" /></svg>,
  images: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>,
  gifts: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 12 20 22 4 22 4 12" /><rect x="2" y="7" width="20" height="5" /><line x1="12" y1="22" x2="12" y2="7" /><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" /><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" /></svg>,
  projects: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>,
}

export default function LiveEditor({ isAuthenticated, gifts, games, initialGameId, initialProjectId }: {
  isAuthenticated: boolean
  gifts: Gift[]
  games: Game[]
  initialGameId: string | null
  initialProjectId: string | null
}) {
  const t = useTranslations("Editor")
  const locale = useLocale()
  const router = useRouter()

  // ── refs ของ engine (ไม่ trigger re-render) ──
  const canvasElRef = useRef<HTMLCanvasElement>(null)
  const fabricRef = useRef<FabricNS | null>(null)
  const canvasRef = useRef<Canvas | null>(null)
  const orientationRef = useRef<Orientation>("portrait")
  const zoomRef = useRef(100)
  const historyRef = useRef<string[]>([])
  const historyIdxRef = useRef(-1)
  const suspendRef = useRef(false) // true ระหว่างโหลด JSON — ไม่บันทึกประวัติ
  const projectIdRef = useRef<string | null>(initialProjectId)
  const projectNameRef = useRef(t("untitled"))
  const productIdRef = useRef<string | null>(initialGameId)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textChangeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dirtyRef = useRef(false)
  // saveProject ประกาศทีหลัง (ต้องใช้ state หลายตัว) — autosave เรียกผ่าน ref จะได้ตัวล่าสุดเสมอ
  const saveProjectRef = useRef<((explicit: boolean) => Promise<void>) | null>(null)

  // ── state ของ UI ──
  const [ready, setReady] = useState(false)
  const [panel, setPanel] = useState<PanelKey | null>("templates")
  const [orientation, setOrientationState] = useState<Orientation>("portrait")
  const [zoom, setZoomState] = useState(100)
  const [display, setDisplay] = useState({ w: 320, h: 569 })
  const [selection, setSelection] = useState<SelectionInfo | null>(null)
  const [isEmpty, setIsEmpty] = useState(true)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [projectId, setProjectId] = useState<string | null>(initialProjectId)
  const [projectName, setProjectName] = useState(() => t("untitled"))
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [busyGameId, setBusyGameId] = useState<string | null>(null)
  const [assets, setAssets] = useState<Asset[]>([])
  const [assetsLoaded, setAssetsLoaded] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [projectsLoaded, setProjectsLoaded] = useState(false)

  useEffect(() => { projectNameRef.current = projectName }, [projectName])

  /* ══ helpers ══ */
  const size = () => CANVAS_SIZES[orientationRef.current]
  const bgObject = (canvas: Canvas) => (canvas.getObjects() as Obj[]).find((o) => o.data?.role === "background") ?? null
  const contentObjects = (canvas: Canvas) => (canvas.getObjects() as Obj[]).filter((o) => o.data?.role !== "background")

  const refreshEmpty = useCallback(() => {
    const c = canvasRef.current
    setIsEmpty(c ? contentObjects(c).length === 0 : true)
  }, [])

  const readSelection = useCallback(() => {
    const f = fabricRef.current, c = canvasRef.current
    if (!f || !c) { setSelection(null); return }
    const active = c.getActiveObjects()
    if (active.length === 0) { setSelection(null); return }
    const o = active[0] as Obj
    const isText = o instanceof f.IText
    const txt = o as unknown as { fontFamily?: string; fontSize?: number; fill?: unknown; stroke?: unknown; strokeWidth?: number; fontWeight?: string | number; textAlign?: string }
    setSelection({
      kind: isText ? "text" : o instanceof f.FabricImage ? "image" : "other",
      multiple: active.length > 1,
      fontFamily: isText ? txt.fontFamily : undefined,
      fontSize: isText ? txt.fontSize : undefined,
      fill: isText && typeof txt.fill === "string" ? txt.fill : undefined,
      stroke: isText && typeof txt.stroke === "string" ? txt.stroke : undefined,
      strokeWidth: isText ? txt.strokeWidth : undefined,
      bold: isText ? String(txt.fontWeight) === "700" || txt.fontWeight === "bold" : undefined,
      textAlign: isText ? txt.textAlign : undefined,
      opacity: o.opacity ?? 1,
    })
  }, [])

  const snapshot = useCallback(() => {
    const c = canvasRef.current
    return c ? JSON.stringify(c.toObject()) : ""
  }, [])

  const syncHistoryFlags = () => {
    setCanUndo(historyIdxRef.current > 0)
    setCanRedo(historyIdxRef.current < historyRef.current.length - 1)
  }

  const scheduleSave = useCallback(() => {
    if (!isAuthenticated) return
    dirtyRef.current = true
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => { void saveProjectRef.current?.(false) }, 2000)
  }, [isAuthenticated])

  const pushHistory = useCallback(() => {
    if (suspendRef.current) return
    const json = snapshot()
    if (!json) return
    const h = historyRef.current
    if (h[historyIdxRef.current] === json) return
    h.splice(historyIdxRef.current + 1) // ทิ้ง redo ที่ค้าง
    h.push(json)
    if (h.length > HISTORY_MAX) h.shift()
    historyIdxRef.current = h.length - 1
    syncHistoryFlags()
    refreshEmpty()
    scheduleSave()
  }, [snapshot, refreshEmpty, scheduleSave])

  const resetHistory = useCallback(() => {
    historyRef.current = [snapshot()]
    historyIdxRef.current = 0
    syncHistoryFlags()
    refreshEmpty()
  }, [snapshot, refreshEmpty])

  // หลังโหลด JSON: prop แบบ interactive ไม่ได้ถูก serialize มาด้วย ต้องล็อกพื้นหลังใหม่
  const afterLoad = useCallback(() => {
    const c = canvasRef.current
    if (!c) return
    const bg = bgObject(c)
    if (bg) { bg.set({ selectable: false, evented: false, hoverCursor: "default" }); c.sendObjectToBack(bg) }
    c.discardActiveObject()
    c.requestRenderAll()
    setSelection(null)
  }, [])

  const loadJson = useCallback(async (json: string | object) => {
    const c = canvasRef.current
    if (!c) return
    suspendRef.current = true
    try {
      await c.loadFromJSON(json)
      afterLoad()
    } finally {
      suspendRef.current = false
    }
  }, [afterLoad])

  const applyViewport = useCallback(() => {
    const c = canvasRef.current
    if (!c) return
    const { w, h } = size()
    const short = baseShort(window.innerWidth)
    const baseW = orientationRef.current === "portrait" ? short : Math.round((short * 16) / 9)
    const scale = (baseW / w) * (zoomRef.current / 100)
    const dw = Math.round(w * scale), dh = Math.round(h * scale)
    c.setDimensions({ width: dw, height: dh })
    c.setZoom(scale)
    c.requestRenderAll()
    setDisplay({ w: dw, h: dh })
  }, [])

  /* ══ init Fabric (client เท่านั้น) ══ */
  useEffect(() => {
    let disposed = false
    let canvas: Canvas | null = null
    let guides: ReturnType<typeof attachSmartGuides> | null = null
    ;(async () => {
      const f = await import("fabric")
      if (disposed || !canvasElRef.current) return
      fabricRef.current = f
      // ลุคของกรอบเลือกให้เหมือน Canva + ให้ data/selectable ติดไปกับ JSON
      Object.assign(f.FabricObject.ownDefaults, {
        cornerStyle: "circle", cornerColor: "#ffffff", cornerStrokeColor: "#2563eb", borderColor: "#2563eb",
        transparentCorners: false, cornerSize: 10, padding: 4, borderScaleFactor: 1.5,
      })
      f.FabricObject.customProperties = ["data", "selectable", "evented", "hoverCursor"]

      canvas = new f.Canvas(canvasElRef.current, { preserveObjectStacking: true, selection: true, controlsAboveOverlay: true })
      canvasRef.current = canvas
      // ตอน dev เปิดให้ส่องจาก console ได้ (ไม่มีใน production)
      if (process.env.NODE_ENV !== "production") {
        const w = window as unknown as { __livegenCanvas?: Canvas; __fabric?: FabricNS }
        w.__livegenCanvas = canvas
        w.__fabric = f
      }

      const onSel = () => readSelection()
      canvas.on("selection:created", onSel)
      canvas.on("selection:updated", onSel)
      canvas.on("selection:cleared", onSel)
      const onChange = () => pushHistory()
      canvas.on("object:added", onChange)
      canvas.on("object:removed", onChange)
      canvas.on("object:modified", () => { pushHistory(); readSelection() })
      canvas.on("text:editing:exited", onChange)
      canvas.on("text:changed", () => {
        if (textChangeTimerRef.current) clearTimeout(textChangeTimerRef.current)
        textChangeTimerRef.current = setTimeout(pushHistory, 600)
      })

      // smart guides แบบ Canva (snap + เส้นจัดแนว + ระยะห่าง px)
      guides = attachSmartGuides(canvas, {
        getSize: () => CANVAS_SIZES[orientationRef.current],
        exclude: (o) => (o as Obj).data?.role === "background",
      })
      if (process.env.NODE_ENV !== "production") (window as unknown as { __livegenGuides?: typeof guides }).__livegenGuides = guides

      applyViewport()
      resetHistory()
      setReady(true)
    })()
    return () => {
      disposed = true
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      guides?.detach()
      canvas?.dispose()
      canvasRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ซูม/หมุนจอ/ย่อหน้าต่าง → คำนวณขนาดแสดงผลใหม่
  useEffect(() => {
    if (!ready) return
    zoomRef.current = zoom
    orientationRef.current = orientation
    applyViewport()
  }, [zoom, orientation, ready, applyViewport])
  useEffect(() => {
    const onResize = () => applyViewport()
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [applyViewport])

  /* ══ การกระทำบน canvas ══ */
  const setOrientation = useCallback((o: Orientation) => {
    const c = canvasRef.current
    if (!c || o === orientationRef.current) return
    orientationRef.current = o
    setOrientationState(o)
    const { w, h } = CANVAS_SIZES[o]
    const bg = bgObject(c)
    if (bg) bg.set({ width: w, height: h, left: 0, top: 0 })
    applyViewport()
    pushHistory()
  }, [applyViewport, pushHistory])

  const addText = useCallback(async (kind: TextKind, family = DEFAULT_FONT) => {
    const f = fabricRef.current, c = canvasRef.current
    if (!f || !c) return
    await ensureFont(family)
    const { w, h } = size()
    const fontSize = kind === "heading" ? Math.round(w * 0.09) : kind === "subheading" ? Math.round(w * 0.06) : Math.round(w * 0.04)
    const text = kind === "heading" ? t("sample_heading") : kind === "subheading" ? t("sample_subheading") : t("sample_body")
    const tb = new f.Textbox(text, {
      width: w * 0.8, fontSize, fontFamily: family, fontWeight: fontWeightFor(family, kind !== "body"),
      fill: "#ffffff", stroke: "#0b0f1a", strokeWidth: kind === "body" ? 0 : Math.max(2, Math.round(fontSize * 0.08)),
      paintFirst: "stroke", strokeUniform: true, textAlign: "center",
      originX: "center", originY: "center", left: w / 2, top: h / 2,
    })
    c.add(tb)
    c.setActiveObject(tb)
    c.requestRenderAll()
  }, [t])

  const addImage = useCallback(async (url: string, widthRatio = 0.6) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const f = fabricRef.current, c = canvasRef.current
    if (!f || !c) return
    let img
    try {
      img = await f.FabricImage.fromURL(canvasSafeUrl(url), { crossOrigin: "anonymous" })
    } catch {
      alert(t("image_load_error"))
      return
    }
    const { w, h } = size()
    img.scaleToWidth(w * widthRatio)
    if (img.getScaledHeight() > h * 0.6) img.scaleToHeight(h * 0.6)
    img.set({ left: w / 2, top: h / 2, originX: "center", originY: "center" })
    c.add(img)
    c.setActiveObject(img)
    c.requestRenderAll()
  }, [])

  const applyBackground = useCallback((p: BgPreset) => {
    const f = fabricRef.current, c = canvasRef.current
    if (!f || !c) return
    const old = bgObject(c)
    suspendRef.current = true
    if (old) c.remove(old)
    suspendRef.current = false
    if (p.kind !== "none") {
      const { w, h } = size()
      const fill = p.kind === "solid"
        ? p.color
        : new f.Gradient({ type: "linear", gradientUnits: "percentage", coords: { x1: 0, y1: 0, x2: 1, y2: 1 }, colorStops: [{ offset: 0, color: p.stops[0] }, { offset: 1, color: p.stops[1] }] })
      // Fabric 7 ค่าเริ่มต้น origin เป็น center — ต้องบอก left/top ชัดๆ ไม่งั้นสี่เหลี่ยมไปอยู่แค่มุมขวาล่าง
      const rect = new f.Rect({ left: 0, top: 0, originX: "left", originY: "top", width: w, height: h, fill, selectable: false, evented: false, hoverCursor: "default" }) as Obj
      rect.data = { role: "background", preset: p.id }
      suspendRef.current = true
      c.add(rect)
      c.sendObjectToBack(rect)
      suspendRef.current = false
    }
    c.requestRenderAll()
    pushHistory()
  }, [pushHistory])

  const clearCanvas = useCallback((o?: Orientation) => {
    const c = canvasRef.current
    if (!c) return
    suspendRef.current = true
    c.clear()
    suspendRef.current = false
    if (o && o !== orientationRef.current) { orientationRef.current = o; setOrientationState(o); applyViewport() }
    c.requestRenderAll()
    setSelection(null)
  }, [applyViewport])

  // เท็มเพลตจากเกม: การ์ดละ ตัวละคร + ของขวัญ (มุมซ้ายบน) + ป้ายชื่อ — วางเป็นวัตถุแยก แก้ได้อิสระ
  const applyGameTemplate = useCallback(async (gameId: string) => {
    const f = fabricRef.current, c = canvasRef.current
    if (!f || !c) return
    setBusyGameId(gameId)
    try {
      const r = await fetch(`/api/livegen/templates/${gameId}`)
      if (!r.ok) throw new Error("template")
      const d = await r.json() as { product: { name_th: string; name_en: string }; functions: { id: string; name: string; label_th: string | null; label_en: string | null; image_url: string | null; gift_image_url: string | null }[] }
      await ensureFont(DEFAULT_FONT)
      clearCanvas()
      const { w, h } = size()
      // สองฝั่งชิดขอบซ้าย/ขวา เว้นกลางไว้ให้ภาพเกม: เรียงตามลำดับใน admin ครึ่งแรกซ้าย ครึ่งหลังขวา (ดู lib/livegen/templateLayout)
      // แนวตั้ง = ฝั่งละ 1 คอลัมน์ · แนวนอน = ฝั่งละ 2 · แบ่งความสูงพอดีทั้งหน้า ขนาดการ์ดคิดจากจำนวน (มาก = เล็ก) ไม่ทะลุจอ
      const { left, right } = splitSides(d.functions)
      const sideCols = orientationRef.current === "portrait" ? 1 : 2
      const rows = Math.max(1, Math.ceil(Math.max(left.length, right.length) / sideCols))
      const marginX = w * 0.03, marginY = h * 0.03
      const gapY = Math.min(h * 0.015, 24), gapX = w * 0.015
      const tileH = (h - marginY * 2 - gapY * (rows - 1)) / rows
      const maxTileW = (w * 0.44 - gapX * (sideCols - 1)) / sideCols // ฝั่งละไม่เกิน 44% ของความกว้าง
      const tileW = Math.min((tileH * 9) / 7, maxTileW)
      // ของในการ์ดขยายให้เต็มกรอบที่มี (ทั้งกว้างและสูง) การ์ดเตี้ยก็ยังได้รูปกว้างสุดเท่าที่ใส่ได้
      const imgBoxW = tileW * 0.86, imgBoxH = tileH * 0.6
      const giftSize = Math.min(tileW * 0.3, tileH * 0.3)
      const fontSize = Math.round(Math.max(16, Math.min(tileW * 0.11, tileH * 0.14)))
      suspendRef.current = true
      const placeTile = async (fn: (typeof d.functions)[number], cx: number, cy: number) => {
        if (fn.image_url) {
          try {
            const img = await f.FabricImage.fromURL(canvasSafeUrl(fn.image_url), { crossOrigin: "anonymous" })
            img.scale(Math.min(imgBoxW / img.width, imgBoxH / img.height))
            img.set({ left: cx, top: cy - tileH * 0.06, originX: "center", originY: "center" })
            c.add(img)
          } catch { /* รูปตัวละครโหลดไม่ได้ก็ข้าม */ }
        }
        if (fn.gift_image_url) {
          try {
            const g = await f.FabricImage.fromURL(canvasSafeUrl(fn.gift_image_url), { crossOrigin: "anonymous" })
            g.scaleToWidth(giftSize)
            g.set({ left: cx - tileW / 2 + giftSize * 0.65, top: cy - tileH / 2 + giftSize * 0.65, originX: "center", originY: "center" })
            c.add(g)
          } catch { /* ข้าม */ }
        }
        const label = (locale === "th" ? fn.label_th : fn.label_en) || fn.label_th || fn.label_en || fn.name
        c.add(new f.Textbox(label, {
          width: tileW * 0.94, fontSize, fontFamily: DEFAULT_FONT, fontWeight: 700,
          fill: "#ffffff", stroke: "#0b0f1a", strokeWidth: Math.max(2, Math.round(fontSize * 0.1)), paintFirst: "stroke", strokeUniform: true,
          textAlign: "center", originX: "center", originY: "center", left: cx, top: cy + tileH / 2 - fontSize * 0.95,
        }))
      }
      for (const [sideIdx, side] of [left, right].entries()) {
        for (let j = 0; j < side.length; j++) {
          const col = j % sideCols, row = Math.floor(j / sideCols)
          const cx = sideIdx === 0
            ? marginX + tileW / 2 + col * (tileW + gapX)
            : w - marginX - tileW / 2 - col * (tileW + gapX)
          const cy = marginY + tileH / 2 + row * (tileH + gapY)
          await placeTile(side[j], cx, cy)
        }
      }
      suspendRef.current = false
      c.requestRenderAll()
      productIdRef.current = gameId
      if (!projectNameRef.current || projectNameRef.current === t("untitled")) {
        const nm = locale === "th" ? d.product.name_th : d.product.name_en
        setProjectName(nm); projectNameRef.current = nm
      }
      pushHistory()
    } catch {
      suspendRef.current = false
      alert(t("template_error"))
    } finally {
      setBusyGameId(null)
    }
  }, [clearCanvas, locale, pushHistory, t])

  /* ══ undo / redo / คีย์ลัด ══ */
  const undo = useCallback(async () => {
    if (historyIdxRef.current <= 0) return
    historyIdxRef.current -= 1
    await loadJson(historyRef.current[historyIdxRef.current])
    syncHistoryFlags(); refreshEmpty(); scheduleSave()
  }, [loadJson, refreshEmpty, scheduleSave])
  const redo = useCallback(async () => {
    if (historyIdxRef.current >= historyRef.current.length - 1) return
    historyIdxRef.current += 1
    await loadJson(historyRef.current[historyIdxRef.current])
    syncHistoryFlags(); refreshEmpty(); scheduleSave()
  }, [loadJson, refreshEmpty, scheduleSave])

  const deleteSelected = useCallback(() => {
    const c = canvasRef.current
    if (!c) return
    const objs = c.getActiveObjects()
    if (objs.length === 0) return
    c.discardActiveObject()
    suspendRef.current = true
    objs.forEach((o) => c.remove(o))
    suspendRef.current = false
    c.requestRenderAll()
    setSelection(null)
    pushHistory()
  }, [pushHistory])

  // วางสำเนา (ใช้ทั้ง Ctrl+D และ Ctrl+V) — ถ้าเลือกหลายชิ้น (ActiveSelection) ต้องแตกลูกๆ add ทีละชิ้น
  // ห้าม add ตัว selection ลง canvas ตรงๆ ไม่งั้น Fabric ฟ้อง "circular object trees" แล้วกรอบเพี้ยน (วิธีตามตัวอย่าง copy/paste ของ Fabric)
  const pasteClone = useCallback(async (source: FabricObject, offset = 40) => {
    const f = fabricRef.current, c = canvasRef.current
    if (!f || !c) return
    const clone = await source.clone()
    c.discardActiveObject()
    clone.set({ left: (clone.left ?? 0) + offset, top: (clone.top ?? 0) + offset, evented: true })
    suspendRef.current = true
    if (clone instanceof f.ActiveSelection) {
      clone.canvas = c
      clone.forEachObject((o) => c.add(o))
      clone.setCoords()
    } else {
      c.add(clone)
    }
    suspendRef.current = false
    c.setActiveObject(clone)
    c.requestRenderAll()
    pushHistory()
  }, [pushHistory])

  const duplicateSelected = useCallback(async () => {
    const o = canvasRef.current?.getActiveObject()
    if (o) await pasteClone(o)
  }, [pasteClone])

  // คลิปบอร์ดภายใน editor (Ctrl+C / Ctrl+V) — เก็บสำเนาไว้ วางซ้ำได้หลายครั้ง เลื่อนลงทีละ 40px
  const clipboardRef = useRef<FabricObject | null>(null)
  const copySelected = useCallback(async () => {
    const o = canvasRef.current?.getActiveObject()
    if (o) clipboardRef.current = await o.clone()
  }, [])
  const pasteClipboard = useCallback(async () => {
    const src = clipboardRef.current
    if (!src) return
    await pasteClone(src)
    src.set({ left: (src.left ?? 0) + 40, top: (src.top ?? 0) + 40 })
  }, [pasteClone])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const c = canvasRef.current
      if (!c) return
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) return
      const active = c.getActiveObject() as (Obj & { isEditing?: boolean }) | undefined
      if (active?.isEditing) return
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) void redo(); else void undo(); return }
      if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); void redo(); return }
      if (mod && e.key.toLowerCase() === "d") { e.preventDefault(); void duplicateSelected(); return }
      if (mod && e.key.toLowerCase() === "c") { if (active) { e.preventDefault(); void copySelected() } return }
      if (mod && e.key.toLowerCase() === "v") { if (clipboardRef.current) { e.preventDefault(); void pasteClipboard() } return }
      if (e.key === "Delete" || e.key === "Backspace") { if (active) { e.preventDefault(); deleteSelected() } return }
      if (e.key === "Escape") { c.discardActiveObject(); c.requestRenderAll(); setSelection(null) }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [undo, redo, duplicateSelected, deleteSelected, copySelected, pasteClipboard])

  /* ══ แถบเครื่องมือของวัตถุที่เลือก ══ */
  const patchText = useCallback(async (p: { fontFamily?: string; fontSize?: number; fill?: string; stroke?: string; strokeWidth?: number; bold?: boolean; textAlign?: "left" | "center" | "right" }) => {
    const f = fabricRef.current, c = canvasRef.current
    if (!f || !c) return
    const o = c.getActiveObject()
    if (!o || !(o instanceof f.IText)) return
    const patch: Record<string, unknown> = {}
    if (p.fontFamily) { await ensureFont(p.fontFamily); f.cache.clearFontCache(p.fontFamily); patch.fontFamily = p.fontFamily; patch.fontWeight = fontWeightFor(p.fontFamily, String(o.fontWeight) === "700") }
    if (p.fontSize != null) patch.fontSize = p.fontSize
    if (p.fill) patch.fill = p.fill
    if (p.stroke) patch.stroke = p.stroke
    if (p.strokeWidth != null) patch.strokeWidth = p.strokeWidth
    if (p.bold != null) patch.fontWeight = fontWeightFor(String(o.fontFamily), p.bold)
    if (p.textAlign) patch.textAlign = p.textAlign
    o.set(patch)
    o.setCoords()
    c.requestRenderAll()
    readSelection()
    pushHistory()
  }, [pushHistory, readSelection])

  const setOpacity = useCallback((v: number) => {
    const c = canvasRef.current
    if (!c) return
    c.getActiveObjects().forEach((o) => o.set({ opacity: v }))
    c.requestRenderAll()
    readSelection()
    if (textChangeTimerRef.current) clearTimeout(textChangeTimerRef.current)
    textChangeTimerRef.current = setTimeout(pushHistory, 400)
  }, [pushHistory, readSelection])

  const moveLayer = useCallback((dir: "up" | "down") => {
    const c = canvasRef.current
    if (!c) return
    const o = c.getActiveObject()
    if (!o) return
    if (dir === "up") c.bringObjectForward(o, true)
    else c.sendObjectBackwards(o, true)
    const bg = bgObject(c)
    if (bg) c.sendObjectToBack(bg) // พื้นหลังต้องอยู่ล่างสุดเสมอ
    c.requestRenderAll()
    pushHistory()
  }, [pushHistory])

  /* ══ รูปภาพของฉัน ══ */
  const loadAssets = useCallback(async () => {
    if (!isAuthenticated) { setAssetsLoaded(true); return }
    const r = await fetch("/api/livegen/assets", { cache: "no-store" })
    if (r.ok) setAssets((await r.json()).assets ?? [])
    setAssetsLoaded(true)
  }, [isAuthenticated])

  const uploadFiles = useCallback(async (files: File[]) => {
    if (!files.length) return
    setUploading(true); setUploadError(null)
    try {
      for (const file of files.slice(0, 10)) {
        const fd = new FormData()
        fd.append("file", file)
        const r = await fetch("/api/livegen/assets", { method: "POST", body: fd })
        if (r.ok) {
          const d = await r.json()
          setAssets((xs) => [d.asset, ...xs])
        } else {
          const d = await r.json().catch(() => ({}))
          setUploadError(d.error === "file_too_large" ? t("upload_too_large") : d.error === "invalid_type" ? t("upload_invalid") : t("upload_error"))
        }
      }
    } finally { setUploading(false) }
  }, [t])

  const deleteAsset = useCallback(async (id: string) => {
    const r = await fetch(`/api/livegen/assets/${id}`, { method: "DELETE" })
    if (r.ok) setAssets((xs) => xs.filter((a) => a.id !== id))
  }, [])

  /* ══ โปรเจค ══ */
  const loadProjects = useCallback(async () => {
    if (!isAuthenticated) { setProjectsLoaded(true); return }
    const r = await fetch("/api/livegen/projects", { cache: "no-store" })
    if (r.ok) setProjects((await r.json()).projects ?? [])
    setProjectsLoaded(true)
  }, [isAuthenticated])

  const payload = () => {
    const c = canvasRef.current!
    return {
      name: projectNameRef.current || t("untitled"),
      orientation: orientationRef.current,
      canvas_json: c.toObject(),
      thumbnail: c.toDataURL({ format: "png", multiplier: 150 / c.getWidth() }),
      product_id: productIdRef.current,
    }
  }

  const saveProject = useCallback(async (explicit: boolean) => {
    const c = canvasRef.current
    if (!c) return
    if (!isAuthenticated) { if (explicit) router.push("/login"); return }
    if (!explicit && !projectIdRef.current && contentObjects(c).length === 0) return // ยังไม่มีอะไรก็ไม่ต้องสร้างโปรเจค
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null }
    setSaveState("saving")
    try {
      const body = JSON.stringify(payload())
      const r = projectIdRef.current
        ? await fetch(`/api/livegen/projects/${projectIdRef.current}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body })
        : await fetch("/api/livegen/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body })
      if (!r.ok) throw new Error("save")
      const d = await r.json()
      if (!projectIdRef.current && d.id) {
        projectIdRef.current = d.id
        setProjectId(d.id)
        window.history.replaceState(null, "", `?project=${d.id}`)
      }
      dirtyRef.current = false
      setSaveState("saved")
      setSavedAt(new Date())
      if (projectsLoaded) void loadProjects()
    } catch {
      setSaveState("error")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, router, projectsLoaded, loadProjects])
  useEffect(() => { saveProjectRef.current = saveProject }, [saveProject])

  const openProject = useCallback(async (id: string) => {
    const r = await fetch(`/api/livegen/projects/${id}`, { cache: "no-store" })
    if (!r.ok) return
    const { project } = await r.json()
    if (!project) return
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null }
    const o: Orientation = project.orientation === "landscape" ? "landscape" : "portrait"
    orientationRef.current = o
    setOrientationState(o)
    applyViewport()
    await loadJson(project.canvas_json)
    projectIdRef.current = project.id
    productIdRef.current = project.product_id ?? null
    setProjectId(project.id)
    setProjectName(project.name); projectNameRef.current = project.name
    setSaveState("saved"); setSavedAt(new Date(project.updated_at))
    dirtyRef.current = false
    resetHistory()
    window.history.replaceState(null, "", `?project=${project.id}`)
  }, [applyViewport, loadJson, resetHistory])

  const newProject = useCallback(() => {
    if (dirtyRef.current && !confirm(t("confirm_discard"))) return
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null }
    clearCanvas()
    projectIdRef.current = null; productIdRef.current = null
    setProjectId(null)
    setProjectName(t("untitled")); projectNameRef.current = t("untitled")
    setSaveState("idle"); setSavedAt(null); dirtyRef.current = false
    resetHistory()
    window.history.replaceState(null, "", location.pathname)
  }, [clearCanvas, resetHistory, t])

  const deleteProject = useCallback(async (id: string) => {
    if (!confirm(t("confirm_delete_project"))) return
    const r = await fetch(`/api/livegen/projects/${id}`, { method: "DELETE" })
    if (!r.ok) return
    setProjects((xs) => xs.filter((p) => p.id !== id))
    if (projectIdRef.current === id) {
      dirtyRef.current = false
      newProject()
    }
  }, [newProject, t])

  // เปิดครั้งแรก: ?project= → โหลดโปรเจค · ?game= → เท็มเพลตเกม
  useEffect(() => {
    if (!ready) return
    // เลื่อนไป tick ถัดไป จะได้ไม่ setState ซ้อนใน effect ตอน mount
    const id = setTimeout(() => {
      if (initialProjectId && isAuthenticated) void openProject(initialProjectId)
      else if (initialGameId) void applyGameTemplate(initialGameId)
    }, 0)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  // โหลดข้อมูลแผงเมื่อเปิดครั้งแรก
  useEffect(() => {
    if (panel === "images" && !assetsLoaded) void loadAssets()
    if (panel === "projects" && !projectsLoaded) void loadProjects()
  }, [panel, assetsLoaded, projectsLoaded, loadAssets, loadProjects])

  /* ══ ดาวน์โหลด PNG ขนาดจริง ══ */
  const download = useCallback(() => {
    const c = canvasRef.current
    if (!c) return
    setDownloading(true)
    try {
      c.discardActiveObject()
      c.requestRenderAll()
      const { w } = size()
      const url = c.toDataURL({ format: "png", multiplier: w / c.getWidth() })
      const a = document.createElement("a")
      a.href = url
      a.download = `${(projectNameRef.current || "live").replace(/[\\/:*?"<>|]+/g, "_")}.png`
      a.click()
    } catch {
      alert(t("download_error"))
    } finally {
      setDownloading(false)
    }
  }, [t])

  /* ══ render ══ */
  const saveLabel = !isAuthenticated
    ? t("login_to_save")
    : saveState === "saving" ? t("saving")
      : saveState === "saved" && savedAt ? t("saved_at", { time: savedAt.toLocaleTimeString(locale === "th" ? "th-TH" : "en-US", { hour: "2-digit", minute: "2-digit" }) })
        : saveState === "error" ? t("save_error") : t("not_saved")

  const ctBtn = "w-8 h-8 rounded-md flex items-center justify-center text-text-muted hover:bg-white/[0.05] hover:text-text-base transition-colors disabled:opacity-40 disabled:pointer-events-none"
  const orientBtn = (o: Orientation) =>
    `px-3 py-1.5 rounded-[7px] text-[0.72rem] font-semibold flex items-center gap-1.5 transition-colors ${orientation === o ? "bg-accent/[0.12] text-accent-light" : "text-text-muted hover:bg-white/[0.04] hover:text-text-base"}`

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href={FONT_LINK_HREF} />

      {/* ── toolbar บน ── */}
      <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-2.5 bg-bg-card border-b border-border-soft">
        <div className="flex items-center gap-2.5 min-w-0">
          <input value={projectName} onChange={(e) => setProjectName(e.target.value)} onBlur={() => { if (projectIdRef.current) scheduleSave() }}
                 className="bg-transparent border border-border-soft rounded-lg px-3 py-1.5 text-text-base text-[0.85rem] font-semibold outline-none focus:border-accent w-[200px] max-md:w-[130px]" />
          <span className="text-[0.72rem] text-text-dim hidden sm:inline truncate">{saveLabel}</span>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <button onClick={() => void saveProject(true)} disabled={saveState === "saving"}
                  className="px-4 py-2 rounded-lg border border-border-soft text-text-muted hover:text-text-base hover:border-border-light text-[0.82rem] font-semibold transition-colors disabled:opacity-50">
            {t("save")}
          </button>
          <button onClick={download} disabled={downloading || !ready}
                  className="px-5 py-2 rounded-lg bg-accent hover:bg-accent-light text-white text-[0.82rem] font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-60">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
            {downloading ? t("downloading") : t("download")}
          </button>
        </div>
      </div>

      {/* ── layout: แท็บ | แผง | canvas ── */}
      <div className="relative flex h-[calc(100vh-110px)] min-h-[700px] max-md:h-[calc(100vh-110px)] max-md:min-h-[560px]">
        <div className="w-14 shrink-0 bg-bg-card border-r border-border-soft flex flex-col items-center py-2.5 gap-0.5">
          {TABS.map((tab) => (
            <button key={tab} onClick={() => setPanel(panel === tab ? null : tab)} title={t(`tab_${tab}`)}
                    className={`w-[42px] h-[42px] rounded-[9px] flex items-center justify-center transition-colors ${
                      panel === tab ? "bg-accent/10 text-accent-light" : "text-text-dim hover:bg-white/[0.04] hover:text-text-muted"}`}>
              {TAB_ICONS[tab]}
            </button>
          ))}
        </div>

        {panel === "templates" && (
          <TemplatesPanel games={games} busyGameId={busyGameId} onClose={() => setPanel(null)}
                          onBlank={(o) => { if (!isEmpty && !confirm(t("confirm_discard"))) return; clearCanvas(o); pushHistory() }}
                          onBackground={applyBackground} onGame={(id) => { if (!isEmpty && !confirm(t("confirm_discard"))) return; void applyGameTemplate(id) }} />
        )}
        {panel === "text" && (
          <TextPanel currentFont={selection?.kind === "text" ? selection.fontFamily ?? null : null} onClose={() => setPanel(null)}
                     onAdd={(k) => void addText(k)}
                     onFont={(family) => { if (selection?.kind === "text") void patchText({ fontFamily: family }); else void addText("heading", family) }} />
        )}
        {panel === "images" && (
          <ImagesPanel isAuthenticated={isAuthenticated} assets={assets} loading={!assetsLoaded} uploading={uploading} error={uploadError}
                       onClose={() => setPanel(null)} onUpload={(files) => void uploadFiles(files)} onPick={(url) => void addImage(url)} onDelete={(id) => void deleteAsset(id)} />
        )}
        {panel === "gifts" && (
          <GiftsPanel gifts={gifts} onClose={() => setPanel(null)} onPick={(g) => { if (g.image_url) void addImage(g.image_url, 0.22) }} />
        )}
        {panel === "projects" && (
          <ProjectsPanel isAuthenticated={isAuthenticated} projects={projects} loading={!projectsLoaded} currentId={projectId}
                         onClose={() => setPanel(null)} onOpen={(id) => { if (dirtyRef.current && !confirm(t("confirm_discard"))) return; void openProject(id) }}
                         onNew={newProject} onDelete={(id) => void deleteProject(id)} />
        )}

        {/* ── พื้นที่ canvas ── */}
        <div className="flex-1 min-w-0 flex flex-col items-center justify-center bg-bg-base relative overflow-hidden p-5">
          <div className="absolute top-3 flex items-center gap-2 bg-bg-card border border-border-soft rounded-[10px] px-2.5 py-1.5 z-10">
            <button onClick={() => void undo()} disabled={!canUndo} className={ctBtn} title={t("undo")}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg>
            </button>
            <button onClick={() => void redo()} disabled={!canRedo} className={ctBtn} title={t("redo")}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>
            </button>
            <div className="w-px h-5 bg-border-soft" />
            <button onClick={() => setZoomState((z) => Math.max(25, z - 10))} className={ctBtn} title={t("zoom_out")}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="8" y1="11" x2="14" y2="11" /></svg>
            </button>
            <div className="text-[0.72rem] text-text-muted font-semibold min-w-[36px] text-center">{zoom}%</div>
            <button onClick={() => setZoomState((z) => Math.min(200, z + 10))} className={ctBtn} title={t("zoom_in")}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" /></svg>
            </button>
          </div>

          {selection && (
            <SelectionBar sel={selection} onText={(p) => void patchText(p)} onOpacity={setOpacity} onLayer={moveLayer}
                          onDuplicate={() => void duplicateSelected()} onDelete={deleteSelected} />
          )}

          <div className="relative shrink-0 max-w-full max-h-full overflow-auto" style={{ width: display.w, height: display.h }}>
            {/* ลายตารางหมากรุก = โปร่งใส (เหมือน Canva) */}
            <div className="absolute inset-0 rounded-md shadow-[0_4px_32px_rgba(0,0,0,0.5)] overflow-hidden"
                 style={{ backgroundColor: "#ffffff", backgroundImage: "conic-gradient(#e2e8f0 0 25%, #ffffff 0 50%, #e2e8f0 0 75%, #ffffff 0)", backgroundSize: "20px 20px" }}>
              <canvas ref={canvasElRef} />
            </div>
            {isEmpty && ready && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 pointer-events-none text-center px-4">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-[#94a3b8]"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
                <p className="text-[0.85rem] text-[#64748b] font-semibold">{t("start_title")}</p>
                <span className="text-[0.72rem] text-[#94a3b8] max-w-[200px]">{t("start_hint")}</span>
              </div>
            )}
          </div>

          <div className="absolute bottom-3 flex items-center gap-1.5 bg-bg-card border border-border-soft rounded-[10px] px-2.5 py-[5px] z-10">
            <button onClick={() => setOrientation("portrait")} className={orientBtn("portrait")}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="2" width="12" height="20" rx="2" /></svg>
              {t("portrait")}
            </button>
            <div className="w-px h-[18px] bg-border-soft" />
            <button onClick={() => setOrientation("landscape")} className={orientBtn("landscape")}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="6" width="20" height="12" rx="2" /></svg>
              {t("landscape")}
            </button>
          </div>
          <p className="absolute bottom-3 right-4 text-[0.62rem] text-text-dim hidden xl:block max-w-[260px] text-right">{t("shortcuts_hint")}</p>
        </div>
      </div>
    </>
  )
}
