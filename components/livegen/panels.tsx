"use client"

// แผงเครื่องมือด้านซ้ายของ editor ตาม designer.html — 5 แท็บ ใช้กรอบ <Panel> ร่วมกัน
import { useRef, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { formatDistanceToNow } from "date-fns"
import { dateFnsLocale } from "@/lib/i18n/locale"
import { Link } from "@/i18n/routing"
import { getImageUrl } from "@/lib/getImageUrl"
import { FONT_OPTIONS } from "@/lib/livegen/fonts"
import { BACKGROUNDS, bgPreviewStyle, type BgPreset } from "@/lib/livegen/backgrounds"
import type { Asset, Game, GameFunction, Gift, Orientation, ProjectSummary, StoreTemplate, TextKind } from "./types"

const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
)
const TextIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-accent-light"><polyline points="4 7 4 4 20 4 20 7" /><line x1="9.5" y1="20" x2="14.5" y2="20" /><line x1="12" y1="4" x2="12" y2="20" /></svg>
)
const LinesIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-accent-light"><line x1="17" y1="10" x2="3" y2="10" /><line x1="21" y1="6" x2="3" y2="6" /><line x1="21" y1="14" x2="3" y2="14" /><line x1="17" y1="18" x2="3" y2="18" /></svg>
)
const FrameIcon = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-border-light"><rect x="3" y="3" width="18" height="18" rx="2" /></svg>
)

/* ── กรอบแผง: หัวเรื่อง + ปุ่มปิด + ช่องค้นหา (ถ้ามี) + เนื้อหาเลื่อนได้ ── */
export function Panel({ title, onClose, search, children }: {
  title: string
  onClose: () => void
  search?: { value: string; onChange: (v: string) => void; placeholder: string }
  children: React.ReactNode
}) {
  const t = useTranslations("Editor")
  return (
    <div className="w-[260px] shrink-0 bg-bg-surface border-r border-border-soft flex flex-col overflow-hidden max-md:absolute max-md:left-14 max-md:top-0 max-md:bottom-0 max-md:z-20 max-md:w-[min(260px,calc(100vw-56px))] max-md:shadow-[8px_0_24px_rgba(0,0,0,0.45)]">
      <div className="px-[18px] pt-4 pb-3 flex items-center justify-between">
        <h2 className="text-[0.95rem] font-bold">{title}</h2>
        <button onClick={onClose} className="w-7 h-7 rounded-md text-text-dim hover:bg-white/[0.04] hover:text-text-base flex items-center justify-center transition-colors" aria-label={t("close")}>
          <CloseIcon />
        </button>
      </div>
      {search && (
        <div className="px-[18px] pb-3">
          <input value={search.value} onChange={(e) => search.onChange(e.target.value)} placeholder={search.placeholder}
                 className="w-full px-3 py-[9px] rounded-lg border border-border-soft bg-bg-card text-text-base text-[0.8rem] outline-none focus:border-accent transition-colors placeholder:text-text-dim" />
        </div>
      )}
      <div className="flex-1 overflow-y-auto px-[18px] pb-[18px] custom-scrollbar">{children}</div>
    </div>
  )
}

const sectionTitle = "text-[0.75rem] font-semibold text-text-dim mb-2"
const tile = "relative overflow-hidden rounded-[10px] border-2 border-border-soft hover:border-accent-light hover:-translate-y-0.5 transition-[border-color,transform] duration-200 flex items-center justify-center"
const tileBg = { background: "var(--gradient-thumb)" }
const tileLabel = "absolute bottom-1.5 left-1.5 right-1.5 text-[0.6rem] text-text-dim text-center bg-black/50 px-1.5 py-[3px] rounded leading-tight truncate"

/* ── เท็มเพลต: แบบเปล่า / พื้นหลัง / เท็มเพลตจากเกม (แอดมินทำในหน้า Game Templates) ── */
export function TemplatesPanel({ templates, busyId, onClose, onBlank, onBackground, onTemplate }: {
  templates: StoreTemplate[]
  busyId: string | null
  onClose: () => void
  onBlank: (o: Orientation) => void
  onBackground: (p: BgPreset) => void
  onTemplate: (id: string) => void
}) {
  const t = useTranslations("Editor")
  const [q, setQ] = useState("")
  const filtered = templates.filter((x) => x.name.toLowerCase().includes(q.trim().toLowerCase()))

  return (
    <Panel title={t("tab_templates")} onClose={onClose} search={{ value: q, onChange: setQ, placeholder: t("search_templates") }}>
      <h4 className={sectionTitle}>{t("blank")}</h4>
      <div className="grid grid-cols-2 gap-2 mb-4">
        <button onClick={() => onBlank("portrait")} className={`${tile} aspect-[9/16]`} style={tileBg}>
          <FrameIcon /><span className={tileLabel}>{t("blank_portrait")}</span>
        </button>
        <button onClick={() => onBlank("landscape")} className={`${tile} aspect-[9/16]`} style={tileBg}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-border-light"><rect x="2" y="6" width="20" height="12" rx="2" /></svg>
          <span className={tileLabel}>{t("blank_landscape")}</span>
        </button>
      </div>

      <h4 className={sectionTitle}>{t("backgrounds")}</h4>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {BACKGROUNDS.map((p) => (
          <button key={p.id} onClick={() => onBackground(p)} className={`${tile} aspect-square`} style={bgPreviewStyle(p)} title={t(`bg_${p.id}`)}>
            <span className={tileLabel}>{t(`bg_${p.id}`)}</span>
          </button>
        ))}
      </div>

      <h4 className={sectionTitle}>{t("game_templates")}</h4>
      {filtered.length === 0 ? (
        <p className="text-[0.75rem] text-text-dim">{t("no_templates")}</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {filtered.map((x) => (
            <button key={x.id} onClick={() => onTemplate(x.id)} disabled={!!busyId} className={`${tile} aspect-[9/16] disabled:opacity-60`} style={tileBg}>
              {x.preview ? <img src={x.preview.startsWith("data:") ? x.preview : getImageUrl(x.preview)} alt="" className="absolute inset-0 w-full h-full object-cover" /> : <FrameIcon />}
              {busyId === x.id && <span className="absolute inset-0 flex items-center justify-center bg-black/40"><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /></span>}
              <span className={tileLabel}>{x.name}</span>
            </button>
          ))}
        </div>
      )}
    </Panel>
  )
}

/* ── ฟังก์ชัน: เลือกเกม แล้วกดรูปฟังก์ชันเพื่อวางลง canvas ทีละรูป ── */
export function FunctionsPanel({ games, initialGameId, onClose, onAdd }: {
  games: Game[]
  initialGameId: string | null
  onClose: () => void
  onAdd: (url: string) => void
}) {
  const t = useTranslations("Editor")
  const isTH = useLocale() === "th"
  const [gameId, setGameId] = useState(() => (games.some((g) => g.id === initialGameId) ? initialGameId : games[0]?.id ?? null))
  const [q, setQ] = useState("")
  const label = (f: GameFunction) => (isTH ? f.label_th : f.label_en) || f.label_th || f.label_en || f.name
  const fns = (games.find((g) => g.id === gameId)?.functions ?? []).filter((f) => label(f).toLowerCase().includes(q.trim().toLowerCase()))

  return (
    <Panel title={t("tab_functions")} onClose={onClose} search={{ value: q, onChange: setQ, placeholder: t("search_functions") }}>
      {games.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {games.map((g) => (
            <button key={g.id} onClick={() => setGameId(g.id)}
                    className={`px-2.5 py-1 rounded-full text-[0.7rem] font-semibold border transition-colors ${
                      g.id === gameId ? "bg-accent/15 border-accent/40 text-accent-light" : "border-border-soft text-text-muted hover:text-text-base"}`}>
              {isTH ? g.name_th : g.name_en}
            </button>
          ))}
        </div>
      )}
      {fns.length === 0 ? (
        <p className="text-[0.75rem] text-text-dim">{t("no_functions")}</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {fns.map((f) => (
            <button key={f.id} onClick={() => onAdd(f.image_url)} title={label(f)} className={`${tile} aspect-square`} style={tileBg}>
              <img src={getImageUrl(f.image_url)} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-contain p-1.5 pb-5" />
              <span className={tileLabel}>{label(f)}</span>
            </button>
          ))}
        </div>
      )}
    </Panel>
  )
}

/* ── ข้อความ: เพิ่มหัวข้อ/หัวข้อรอง/เนื้อหา + รายการฟอนต์ ── */
export function TextPanel({ currentFont, onClose, onAdd, onFont }: {
  currentFont: string | null
  onClose: () => void
  onAdd: (kind: TextKind) => void
  onFont: (family: string) => void
}) {
  const t = useTranslations("Editor")
  const addBtn = "w-full p-3 rounded-[10px] border border-border-soft bg-bg-card text-text-base flex items-center gap-2.5 hover:border-accent-light transition-colors text-left"
  return (
    <Panel title={t("tab_text")} onClose={onClose}>
      <div className="flex flex-col gap-2.5">
        <button onClick={() => onAdd("heading")} className={`${addBtn} text-[1.1rem] font-extrabold`}><TextIcon />{t("add_heading")}</button>
        <button onClick={() => onAdd("subheading")} className={`${addBtn} text-[0.92rem] font-bold`}><TextIcon />{t("add_subheading")}</button>
        <button onClick={() => onAdd("body")} className={`${addBtn} text-[0.82rem] font-semibold`}><LinesIcon />{t("add_body")}</button>
      </div>
      <div className="mt-3.5">
        <h4 className={sectionTitle}>{t("popular_fonts")}</h4>
        <p className="text-[0.68rem] text-text-dim mb-2">{t("font_hint")}</p>
        <div className="flex flex-col gap-1">
          {FONT_OPTIONS.map((f) => (
            <button key={f.family} onClick={() => onFont(f.family)} style={{ fontFamily: `"${f.family}", sans-serif` }}
                    className={`px-3 py-2.5 rounded-lg text-left text-[0.85rem] transition-colors ${currentFont === f.family ? "bg-accent/10 text-accent-light" : "hover:bg-white/[0.03]"}`}>
              {f.family}
            </button>
          ))}
        </div>
      </div>
    </Panel>
  )
}

/* ── รูปภาพ: อัปโหลด + รูปของฉัน ── */
export function ImagesPanel({ isAuthenticated, assets, loading, uploading, error, onClose, onUpload, onPick, onDelete }: {
  isAuthenticated: boolean
  assets: Asset[]
  loading: boolean
  uploading: boolean
  error: string | null
  onClose: () => void
  onUpload: (files: File[]) => void
  onPick: (url: string) => void
  onDelete: (id: string) => void
}) {
  const t = useTranslations("Editor")
  const inputRef = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)

  return (
    <Panel title={t("tab_images")} onClose={onClose}>
      {isAuthenticated ? (
        <div
          onClick={() => !uploading && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); onUpload(Array.from(e.dataTransfer.files)) }}
          className={`border-2 border-dashed rounded-xl px-4 py-7 text-center cursor-pointer transition-colors mb-3.5 ${
            drag ? "border-accent-light bg-accent/[0.03]" : "border-border-soft hover:border-accent-light hover:bg-accent/[0.03]"}`}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-dim mx-auto mb-2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
          <div className="text-[0.85rem] font-semibold text-accent-light mb-1">{uploading ? t("uploading") : t("upload_title")}</div>
          <p className="text-[0.78rem] text-text-dim">{t("upload_hint")}</p>
          <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden
                 onChange={(e) => { onUpload(Array.from(e.target.files ?? [])); e.target.value = "" }} />
        </div>
      ) : (
        <div className="border-2 border-dashed border-border-soft rounded-xl px-4 py-6 text-center mb-3.5">
          <p className="text-[0.78rem] text-text-dim mb-3">{t("login_to_upload")}</p>
          <Link href="/login" className="inline-block px-4 py-2 rounded-lg bg-accent hover:bg-accent-light text-white text-[0.78rem] font-semibold transition-colors">{t("login")}</Link>
        </div>
      )}
      {error && <p className="text-[0.75rem] text-hot mb-2">{error}</p>}

      <h4 className="text-[0.78rem] font-semibold text-text-dim mb-2.5">{t("my_images")}</h4>
      {loading ? (
        <p className="text-[0.75rem] text-text-dim">{t("loading")}</p>
      ) : assets.length === 0 ? (
        <p className="text-[0.75rem] text-text-dim">{t("no_images")}</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {assets.map((a) => (
            <div key={a.id} className="relative group">
              <button onClick={() => onPick(a.url)} className={`${tile} aspect-square w-full`} style={tileBg} title={a.filename ?? ""}>
                <img src={getImageUrl(a.url)} alt="" className="absolute inset-0 w-full h-full object-cover" />
              </button>
              <button onClick={() => onDelete(a.id)} title={t("delete")}
                      className="absolute top-1 right-1 w-6 h-6 rounded-md bg-black/60 text-white text-[0.75rem] opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">×</button>
            </div>
          ))}
        </div>
      )}
    </Panel>
  )
}

/* ── ของขวัญ TikTok ── */
export function GiftsPanel({ gifts, onClose, onPick }: { gifts: Gift[]; onClose: () => void; onPick: (g: Gift) => void }) {
  const t = useTranslations("Editor")
  const [q, setQ] = useState("")
  const filtered = gifts.filter((g) => g.image_url && g.name.toLowerCase().includes(q.trim().toLowerCase()))
  return (
    <Panel title={t("tab_gifts")} onClose={onClose} search={{ value: q, onChange: setQ, placeholder: t("search_gifts") }}>
      {filtered.length === 0 ? (
        <p className="text-[0.75rem] text-text-dim">{t("no_gifts")}</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {filtered.map((g) => (
            <button key={g.id} onClick={() => onPick(g)} title={`${g.name} · ${g.diamonds} 💎`}
                    className="aspect-square rounded-[10px] border-2 border-border-soft hover:border-violet-400 hover:-translate-y-0.5 transition-[border-color,transform] duration-200 flex flex-col items-center justify-center gap-1 p-1.5"
                    style={{ background: "linear-gradient(145deg,#1a1028,#140e22)" }}>
              <img src={getImageUrl(g.image_url!)} alt="" loading="lazy" className="w-7 h-7 object-contain" />
              <span className="text-[0.55rem] text-text-dim text-center leading-tight line-clamp-1 w-full">{g.name}</span>
            </button>
          ))}
        </div>
      )}
    </Panel>
  )
}

/* ── โปรเจคของคุณ ── */
export function ProjectsPanel({ isAuthenticated, projects, loading, currentId, onClose, onOpen, onNew, onDelete }: {
  isAuthenticated: boolean
  projects: ProjectSummary[]
  loading: boolean
  currentId: string | null
  onClose: () => void
  onOpen: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
}) {
  const t = useTranslations("Editor")
  const locale = useLocale()
  const ago = (s: string) => formatDistanceToNow(new Date(s), { addSuffix: true, locale: dateFnsLocale(locale) })

  return (
    <Panel title={t("tab_projects")} onClose={onClose}>
      {!isAuthenticated ? (
        <div className="border-2 border-dashed border-border-soft rounded-xl px-4 py-6 text-center">
          <p className="text-[0.78rem] text-text-dim mb-3">{t("login_to_see_projects")}</p>
          <Link href="/login" className="inline-block px-4 py-2 rounded-lg bg-accent hover:bg-accent-light text-white text-[0.78rem] font-semibold transition-colors">{t("login")}</Link>
        </div>
      ) : (
        <>
          <button onClick={onNew} className="w-full mb-3 p-3 rounded-[10px] border border-dashed border-border-light text-accent-light text-[0.82rem] font-semibold flex items-center justify-center gap-2 hover:bg-accent/[0.05] transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            {t("new_project")}
          </button>
          {loading ? (
            <p className="text-[0.75rem] text-text-dim">{t("loading")}</p>
          ) : projects.length === 0 ? (
            <p className="text-[0.75rem] text-text-dim">{t("no_projects")}</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {projects.map((p) => (
                <div key={p.id} className="relative group">
                  <button onClick={() => onOpen(p.id)}
                          className={`${tile} w-full ${p.orientation === "landscape" ? "aspect-square" : "aspect-[9/16]"} flex-col gap-1.5 ${currentId === p.id ? "!border-accent" : ""}`} style={tileBg}>
                    {p.thumbnail ? <img src={p.thumbnail} alt="" className="absolute inset-0 w-full h-full object-contain p-1" /> : <FrameIcon />}
                    <span className="absolute bottom-1.5 left-1.5 right-1.5 bg-black/60 rounded px-1.5 py-1 text-left">
                      <span className="block text-[0.62rem] text-text-base font-semibold truncate">{p.name}</span>
                      <span className="block text-[0.52rem] text-text-dim truncate">{ago(p.updated_at)}</span>
                    </span>
                  </button>
                  <button onClick={() => onDelete(p.id)} title={t("delete")}
                          className="absolute top-1 right-1 w-6 h-6 rounded-md bg-black/60 text-white text-[0.75rem] opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">×</button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Panel>
  )
}
