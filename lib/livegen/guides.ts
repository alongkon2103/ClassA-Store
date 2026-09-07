// Smart guides แบบ Canva สำหรับ Fabric.js
//  - ลากวัตถุแล้วขอบ/กึ่งกลางใกล้ขอบ/กึ่งกลางของชิ้นอื่นหรือของ canvas → ดูดเข้าหา (snap) + วาดเส้นชมพู
//  - แสดงระยะห่าง (px ของภาพจริง) ถึงชิ้นที่ใกล้ที่สุดแต่ละด้าน และถึงขอบ canvas ถ้าไม่มีชิ้นอื่นขวาง
// วาดบน contextTop ของ Fabric (ชั้นบนสุด ไม่ติดไปกับรูปตอน export)
import type { Canvas, FabricObject, TBBox } from "fabric"

type Line = { x1: number; y1: number; x2: number; y2: number }
type Measure = Line & { label: string }

export type GuidesOptions = {
  getSize: () => { w: number; h: number }
  /** วัตถุที่ไม่ใช้เป็นจุดอ้างอิง (เช่น พื้นหลัง) */
  exclude?: (o: FabricObject) => boolean
  color?: string
  /** ระยะดูด หน่วยเป็น px บนจอ */
  snapPx?: number
}

export function attachSmartGuides(canvas: Canvas, opts: GuidesOptions) {
  const color = opts.color ?? "#ff2d8a"
  const snapPx = opts.snapPx ?? 7
  let vLines: Line[] = []
  let hLines: Line[] = []
  let measures: Measure[] = []
  let active = false
  let topDirty = false

  const bbox = (o: FabricObject): TBBox => o.getBoundingRect()
  const xEdges = (b: TBBox) => [b.left, b.left + b.width / 2, b.left + b.width]
  const yEdges = (b: TBBox) => [b.top, b.top + b.height / 2, b.top + b.height]

  // ชิ้นอื่นที่ใช้อ้างอิง — ถ้า target เป็น ActiveSelection ต้องตัดลูกๆ ของมันออกด้วย
  const others = (target: FabricObject) => {
    const inSel = new Set<FabricObject>()
    const t = target as FabricObject & { getObjects?: () => FabricObject[] }
    if (typeof t.getObjects === "function") t.getObjects().forEach((o) => inSel.add(o))
    return canvas.getObjects().filter((o) => o !== target && !inSel.has(o) && o.visible !== false && !opts.exclude?.(o))
  }

  type Best = { d: number; v: number; b: TBBox | null }
  const bestSnap = (targetEdges: number[], cands: { v: number; b: TBBox | null }[], thr: number): Best | null => {
    let best: Best | null = null
    for (const te of targetEdges) {
      for (const c of cands) {
        const d = c.v - te
        if (Math.abs(d) <= thr && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, v: c.v, b: c.b }
      }
    }
    return best
  }

  const onMoving = (e: { target?: FabricObject }) => {
    const target = e.target
    if (!target) return
    active = true
    vLines = []; hLines = []; measures = []
    const { w, h } = opts.getSize()
    const thr = snapPx / canvas.getZoom()
    const cands = others(target).map((o) => bbox(o))

    // ── snap แกน X / Y ──
    const tb = bbox(target)
    const xs: { v: number; b: TBBox | null }[] = [{ v: 0, b: null }, { v: w / 2, b: null }, { v: w, b: null }]
    const ys: { v: number; b: TBBox | null }[] = [{ v: 0, b: null }, { v: h / 2, b: null }, { v: h, b: null }]
    for (const b of cands) { for (const v of xEdges(b)) xs.push({ v, b }); for (const v of yEdges(b)) ys.push({ v, b }) }
    const bx = bestSnap(xEdges(tb), xs, thr)
    const by = bestSnap(yEdges(tb), ys, thr)
    if (bx) target.set({ left: (target.left ?? 0) + bx.d })
    if (by) target.set({ top: (target.top ?? 0) + by.d })
    if (bx || by) target.setCoords()
    const nb = bbox(target)

    if (bx) {
      const y1 = bx.b ? Math.min(nb.top, bx.b.top) : 0
      const y2 = bx.b ? Math.max(nb.top + nb.height, bx.b.top + bx.b.height) : h
      vLines.push({ x1: bx.v, y1, x2: bx.v, y2 })
    }
    if (by) {
      const x1 = by.b ? Math.min(nb.left, by.b.left) : 0
      const x2 = by.b ? Math.max(nb.left + nb.width, by.b.left + by.b.width) : w
      hLines.push({ x1, y1: by.v, x2, y2: by.v })
    }

    // ── ระยะห่างถึงเพื่อนบ้านที่ใกล้สุดแต่ละด้าน (ต้องซ้อนทับกันในแกนตั้งฉาก) ──
    const nbR = nb.left + nb.width, nbB = nb.top + nb.height
    const overlapY = (b: TBBox) => Math.min(nbB, b.top + b.height) - Math.max(nb.top, b.top) > 0
    const overlapX = (b: TBBox) => Math.min(nbR, b.left + b.width) - Math.max(nb.left, b.left) > 0
    type Near = { gap: number; b: TBBox } | null
    let left: Near = null, right: Near = null, top: Near = null, bottom: Near = null
    for (const b of cands) {
      if (overlapY(b)) {
        if (b.left + b.width <= nb.left + 0.5) { const gap = nb.left - (b.left + b.width); if (!left || gap < left.gap) left = { gap, b } }
        else if (b.left >= nbR - 0.5) { const gap = b.left - nbR; if (!right || gap < right.gap) right = { gap, b } }
      }
      if (overlapX(b)) {
        if (b.top + b.height <= nb.top + 0.5) { const gap = nb.top - (b.top + b.height); if (!top || gap < top.gap) top = { gap, b } }
        else if (b.top >= nbB - 0.5) { const gap = b.top - nbB; if (!bottom || gap < bottom.gap) bottom = { gap, b } }
      }
    }
    const midY = (b: TBBox | null) => b ? (Math.max(nb.top, b.top) + Math.min(nbB, b.top + b.height)) / 2 : nb.top + nb.height / 2
    const midX = (b: TBBox | null) => b ? (Math.max(nb.left, b.left) + Math.min(nbR, b.left + b.width)) / 2 : nb.left + nb.width / 2
    const px = (n: number) => `${Math.round(n)} px`
    // ไม่มีเพื่อนบ้านด้านนั้น → วัดถึงขอบ canvas (เฉพาะเมื่ออยู่ใกล้ขอบพอสมควร)
    const edgeLimit = Math.max(w, h) * 0.25
    if (left) measures.push({ x1: left.b.left + left.b.width, x2: nb.left, y1: midY(left.b), y2: midY(left.b), label: px(left.gap) })
    else if (nb.left > 0.5 && nb.left <= edgeLimit) measures.push({ x1: 0, x2: nb.left, y1: midY(null), y2: midY(null), label: px(nb.left) })
    if (right) measures.push({ x1: nbR, x2: right.b.left, y1: midY(right.b), y2: midY(right.b), label: px(right.gap) })
    else if (w - nbR > 0.5 && w - nbR <= edgeLimit) measures.push({ x1: nbR, x2: w, y1: midY(null), y2: midY(null), label: px(w - nbR) })
    if (top) measures.push({ x1: midX(top.b), x2: midX(top.b), y1: top.b.top + top.b.height, y2: nb.top, label: px(top.gap) })
    else if (nb.top > 0.5 && nb.top <= edgeLimit) measures.push({ x1: midX(null), x2: midX(null), y1: 0, y2: nb.top, label: px(nb.top) })
    if (bottom) measures.push({ x1: midX(bottom.b), x2: midX(bottom.b), y1: nbB, y2: bottom.b.top, label: px(bottom.gap) })
    else if (h - nbB > 0.5 && h - nbB <= edgeLimit) measures.push({ x1: midX(null), x2: midX(null), y1: nbB, y2: h, label: px(h - nbB) })

    canvas.requestRenderAll()
  }

  const clear = () => {
    if (!active) return
    active = false
    vLines = []; hLines = []; measures = []
    canvas.requestRenderAll()
  }

  const toDisplay = (x: number, y: number): [number, number] => {
    const v = canvas.viewportTransform
    return [x * v[0] + v[4], y * v[3] + v[5]]
  }

  const beforeRender = () => {
    if (topDirty) { canvas.clearContext(canvas.contextTop); topDirty = false }
  }

  const afterRender = () => {
    if (!active || vLines.length + hLines.length + measures.length === 0) return
    const ctx = canvas.contextTop
    ctx.save()
    ctx.strokeStyle = color
    ctx.fillStyle = color
    ctx.lineWidth = 1
    ctx.setLineDash([])
    // เส้นจัดแนว
    for (const l of [...vLines, ...hLines]) {
      const [x1, y1] = toDisplay(l.x1, l.y1), [x2, y2] = toDisplay(l.x2, l.y2)
      ctx.beginPath(); ctx.moveTo(Math.round(x1) + 0.5, Math.round(y1) + 0.5); ctx.lineTo(Math.round(x2) + 0.5, Math.round(y2) + 0.5); ctx.stroke()
    }
    // เส้นวัดระยะ + ป้ายตัวเลข (ซ่อนถ้าช่วงสั้นกว่า 4px บนจอ)
    ctx.font = "600 10px Inter, 'Noto Sans Thai', sans-serif"
    ctx.textAlign = "center"; ctx.textBaseline = "middle"
    for (const m of measures) {
      const [x1, y1] = toDisplay(m.x1, m.y1), [x2, y2] = toDisplay(m.x2, m.y2)
      const len = Math.hypot(x2 - x1, y2 - y1)
      if (len < 4) continue
      const horiz = Math.abs(y2 - y1) < 0.01
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
      // ขีดปลาย
      const tick = 4
      ctx.beginPath()
      if (horiz) { ctx.moveTo(x1, y1 - tick); ctx.lineTo(x1, y1 + tick); ctx.moveTo(x2, y2 - tick); ctx.lineTo(x2, y2 + tick) }
      else { ctx.moveTo(x1 - tick, y1); ctx.lineTo(x1 + tick, y1); ctx.moveTo(x2 - tick, y2); ctx.lineTo(x2 + tick, y2) }
      ctx.stroke()
      // ป้าย
      const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2
      const tw = ctx.measureText(m.label).width + 10, th = 16
      const lx = horiz ? cx : cx + 8 + tw / 2, ly = horiz ? cy - 12 : cy
      ctx.beginPath()
      ctx.roundRect(lx - tw / 2, ly - th / 2, tw, th, 4)
      ctx.fill()
      ctx.fillStyle = "#ffffff"
      ctx.fillText(m.label, lx, ly + 0.5)
      ctx.fillStyle = color
    }
    ctx.restore()
    topDirty = true
  }

  canvas.on("object:moving", onMoving)
  canvas.on("mouse:up", clear)
  canvas.on("object:modified", clear)
  canvas.on("selection:cleared", clear)
  canvas.on("before:render", beforeRender)
  canvas.on("after:render", afterRender)

  return {
    detach() {
      canvas.off("object:moving", onMoving)
      canvas.off("mouse:up", clear)
      canvas.off("object:modified", clear)
      canvas.off("selection:cleared", clear)
      canvas.off("before:render", beforeRender)
      canvas.off("after:render", afterRender)
    },
    /** สำหรับ dev/test */
    debug: () => ({ vLines, hLines, measures, active }),
  }
}
