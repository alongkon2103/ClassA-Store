"use client"

// แถบเครื่องมือลอยของวัตถุที่เลือก (แบบ Canva): ฟอนต์/ขนาด/สี/เส้นขอบ/ตัวหนา/จัดแนว + เลเยอร์/ก๊อป/ลบ
import { useTranslations } from "next-intl"
import { FONT_OPTIONS } from "@/lib/livegen/fonts"
import type { SelectionInfo } from "./types"

type TextPatch = { fontFamily?: string; fontSize?: number; fill?: string; stroke?: string; strokeWidth?: number; bold?: boolean; textAlign?: "left" | "center" | "right" }

const btn = "w-8 h-8 rounded-md flex items-center justify-center text-text-muted hover:bg-white/[0.05] hover:text-text-base transition-colors disabled:opacity-40"
const sep = <div className="w-px h-5 bg-border-soft" />

export default function SelectionBar({ sel, onText, onOpacity, onLayer, onDuplicate, onDelete }: {
  sel: SelectionInfo
  onText: (p: TextPatch) => void
  onOpacity: (v: number) => void
  onLayer: (dir: "up" | "down") => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const t = useTranslations("Editor")
  const isText = sel.kind === "text" && !sel.multiple
  const input = "h-8 rounded-md border border-border-soft bg-bg-base text-text-base text-[0.72rem] px-2 outline-none focus:border-accent"

  return (
    <div className="absolute top-[58px] flex items-center gap-1 bg-bg-card border border-border-soft rounded-[10px] px-2 py-1.5 z-10 max-w-[calc(100%-24px)] flex-wrap justify-center">
      {isText && (
        <>
          <select value={sel.fontFamily ?? ""} onChange={(e) => onText({ fontFamily: e.target.value })} className={`${input} w-[120px]`} title={t("font")}>
            {FONT_OPTIONS.map((f) => <option key={f.family} value={f.family}>{f.family}</option>)}
          </select>
          <input type="number" min={8} max={600} value={sel.fontSize ?? 40} onChange={(e) => onText({ fontSize: Math.max(8, Math.min(600, Number(e.target.value) || 8)) })}
                 className={`${input} w-[62px]`} title={t("size")} />
          <label className={`${btn} cursor-pointer relative`} title={t("color")}>
            <span className="w-4 h-4 rounded-sm border border-white/30" style={{ background: sel.fill ?? "#fff" }} />
            <input type="color" value={sel.fill ?? "#ffffff"} onChange={(e) => onText({ fill: e.target.value })} className="absolute inset-0 opacity-0 cursor-pointer" />
          </label>
          <label className={`${btn} cursor-pointer relative`} title={t("stroke_color")}>
            <span className="w-4 h-4 rounded-sm border-2" style={{ borderColor: sel.stroke ?? "#000", background: "transparent" }} />
            <input type="color" value={sel.stroke ?? "#000000"} onChange={(e) => onText({ stroke: e.target.value })} className="absolute inset-0 opacity-0 cursor-pointer" />
          </label>
          <select value={sel.strokeWidth ?? 0} onChange={(e) => onText({ strokeWidth: Number(e.target.value) })} className={`${input} w-[58px]`} title={t("stroke_width")}>
            {[0, 2, 4, 6, 8, 12, 16].map((n) => <option key={n} value={n}>{n === 0 ? t("no_stroke") : n}</option>)}
          </select>
          <button onClick={() => onText({ bold: !sel.bold })} className={`${btn} font-black text-[0.85rem] ${sel.bold ? "bg-accent/15 text-accent-light" : ""}`} title={t("bold")}>B</button>
          {(["left", "center", "right"] as const).map((a) => (
            <button key={a} onClick={() => onText({ textAlign: a })} className={`${btn} ${sel.textAlign === a ? "bg-accent/15 text-accent-light" : ""}`} title={t(`align_${a}`)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" />
                {a === "left" && <line x1="3" y1="12" x2="15" y2="12" />}{a === "center" && <line x1="6" y1="12" x2="18" y2="12" />}{a === "right" && <line x1="9" y1="12" x2="21" y2="12" />}
              </svg>
            </button>
          ))}
          {sep}
        </>
      )}
      <label className="flex items-center gap-1.5 px-1" title={t("opacity")}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-dim"><circle cx="12" cy="12" r="9" /><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none" /></svg>
        <input type="range" min={10} max={100} value={Math.round(sel.opacity * 100)} onChange={(e) => onOpacity(Number(e.target.value) / 100)} className="w-16 accent-accent" />
      </label>
      {sep}
      <button onClick={() => onLayer("up")} className={btn} title={t("bring_forward")}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 11 12 6 7 11" /><polyline points="17 18 12 13 7 18" /></svg>
      </button>
      <button onClick={() => onLayer("down")} className={btn} title={t("send_backward")}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="7 13 12 18 17 13" /><polyline points="7 6 12 11 17 6" /></svg>
      </button>
      <button onClick={onDuplicate} className={btn} title={t("duplicate")}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
      </button>
      <button onClick={onDelete} className={`${btn} hover:!text-hot`} title={t("delete")}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
      </button>
    </div>
  )
}
