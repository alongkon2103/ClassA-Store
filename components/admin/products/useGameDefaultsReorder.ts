"use client"

import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from "react"

type Kind = "actions" | "effects"
type Drag = { kind: Kind; id: string; label: string; x: number; y: number; to: number; keyboard: boolean; overId?: string; after?: boolean }
type Pending = { kind: Kind; id: string; label: string; x: number; y: number; pointerId: number; target: HTMLElement }

export default function useGameDefaultsReorder({ root, disabled, th, onReorder }: { root: RefObject<HTMLDivElement | null>; disabled: boolean; th: boolean; onReorder: (kind: Kind, id: string, to: number) => void }) {
  const pending = useRef<Pending | null>(null), current = useRef<Drag | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null), [announcement, setAnnouncement] = useState("")
  const helpId = useId()
  const rows = (kind: Kind) => [...(root.current?.querySelectorAll<HTMLElement>(`[data-reorder-list="${kind}"] [data-reorder-id]`) || [])]
  const update = (next: Drag | null) => { current.current = next; setDrag(next) }
  const position = (active: Drag, to: number): Drag => {
    const others = rows(active.kind).filter(row => row.dataset.reorderId !== active.id)
    return { ...active, to, overId: to >= 0 ? (others[to] || others.at(-1))?.dataset.reorderId : undefined, after: to === others.length }
  }
  const finish = (commit: boolean) => {
    const active = current.current, pointer = pending.current
    pending.current = null; update(null)
    if (pointer?.target.hasPointerCapture(pointer.pointerId)) pointer.target.releasePointerCapture(pointer.pointerId)
    if (active && commit) { onReorder(active.kind, active.id, active.to); setAnnouncement(th ? `ย้าย ${active.label} ไปอันดับ ${active.to + 1} แล้ว` : `${active.label} moved to position ${active.to + 1}`) }
    else if (active) setAnnouncement(th ? "ยกเลิกการย้ายแล้ว" : "Reordering cancelled")
  }
  const point = (active: Drag, x: number, y: number): Drag => {
    const all = rows(active.kind), others = all.filter(row => row.dataset.reorderId !== active.id)
    const list = all[0]?.parentElement?.getBoundingClientRect()
    if (!list || x < list.left - 24 || x > list.right + 24) return { ...active, x, y, to: -1, overId: undefined }
    const to = others.findIndex(row => y < row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2)
    return position({ ...active, x, y }, to < 0 ? others.length : to)
  }
  const pointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const pointer = pending.current
    if (!pointer || pointer.pointerId !== event.pointerId) return
    if (!current.current && Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) < 6) return
    event.preventDefault()
    const start = current.current || { kind: pointer.kind, id: pointer.id, label: pointer.label, x: pointer.x, y: pointer.y, to: rows(pointer.kind).findIndex(row => row.dataset.reorderId === pointer.id), keyboard: false }
    update(point(start, event.clientX, event.clientY))
  }
  const keyboard = (event: KeyboardEvent<HTMLButtonElement>, kind: Kind, id: string, label: string) => {
    if (disabled) return
    const active = current.current
    if (!active && [" ", "Enter"].includes(event.key)) {
      event.preventDefault(); update({ kind, id, label, to: rows(kind).findIndex(row => row.dataset.reorderId === id), keyboard: true, x: 0, y: 0 }); setAnnouncement(th ? "ใช้ลูกศรขึ้นลงเพื่อเลือกตำแหน่ง กด Enter เพื่อวาง หรือ Esc เพื่อยกเลิก" : "Use up/down arrows to choose a position, Enter to drop, Escape to cancel")
    } else if (active?.keyboard && active.id === id) {
      if (["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
        event.preventDefault()
        const count = rows(kind).length, to = event.key === "Home" ? 0 : event.key === "End" ? count - 1 : Math.max(0, Math.min(count - 1, active.to + (event.key === "ArrowUp" ? -1 : 1)))
        update(position(active, to)); setAnnouncement(th ? `ตำแหน่ง ${to + 1} จาก ${count}` : `Position ${to + 1} of ${count}`)
      } else if ([" ", "Enter", "Escape", "Tab"].includes(event.key)) {
        if (event.key !== "Tab") event.preventDefault()
        finish(event.key === " " || event.key === "Enter")
      }
    }
  }
  const pointerDragging = !!drag && !drag.keyboard
  useEffect(() => {
    if (!pointerDragging) return
    const selection = window.document.body.style.userSelect, cursor = window.document.body.style.cursor
    window.document.body.style.userSelect = "none"; window.document.body.style.cursor = "grabbing"
    let frame: number
    const scroll = () => {
      const active = current.current
      if (!active) return
      const delta = active.y < 72 ? -12 : active.y > innerHeight - 72 ? 12 : 0
      if (delta) { window.scrollBy(0, delta); update(point(active, active.x, active.y)) }
      frame = requestAnimationFrame(scroll)
    }
    frame = requestAnimationFrame(scroll)
    const cancel = (event: globalThis.KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); finish(false) } }
    const blur = () => finish(false)
    window.addEventListener("keydown", cancel); window.addEventListener("blur", blur)
    return () => { cancelAnimationFrame(frame); window.document.body.style.userSelect = selection; window.document.body.style.cursor = cursor; window.removeEventListener("keydown", cancel); window.removeEventListener("blur", blur) }
    // The gesture uses refs for current coordinates; it must not restart on every pointer move.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointerDragging])
  useEffect(() => { if (disabled && current.current) finish(false) }, [disabled]) // eslint-disable-line react-hooks/exhaustive-deps
  const marker = drag?.overId ? { kind: drag.kind, id: drag.overId, after: drag.after } : null
  return { drag, marker, announcement, helpId,
    handle: (kind: Kind, id: string, label: string) => ({
      "aria-label": `${th ? "ลากเรียงลำดับ" : "Reorder"} ${label}`, "aria-describedby": helpId, "aria-pressed": drag?.id === id && drag.kind === kind, disabled,
      onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => keyboard(event, kind, id, label),
      onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
        if (disabled || event.button !== 0 || current.current) return
        event.preventDefault(); event.currentTarget.focus({ preventScroll: true }); event.currentTarget.setPointerCapture(event.pointerId)
        pending.current = { kind, id, label, x: event.clientX, y: event.clientY, pointerId: event.pointerId, target: event.currentTarget }
      }, onPointerMove: pointerMove,
      onPointerUp: (event: PointerEvent<HTMLButtonElement>) => { if (pending.current?.pointerId === event.pointerId) finish(!!current.current && current.current.to >= 0) },
      onPointerCancel: () => finish(false), onLostPointerCapture: () => { if (pending.current) finish(false) },
    }),
  }
}
