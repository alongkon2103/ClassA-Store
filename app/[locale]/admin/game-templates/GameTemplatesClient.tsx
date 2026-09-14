"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Link } from "@/i18n/routing"
import { getImageUrl } from "@/lib/getImageUrl"
import { TEMPLATE_FILE_FORMAT } from "@/components/livegen/types"

export type TemplateRow = {
  id: string; name: string; kind: "image" | "canvas"; orientation: "portrait" | "landscape"
  preview: string | null // รูปตัวอย่าง: URL รูป (image) หรือ data URL จากไฟล์ดีไซน์ (canvas)
  cover: string | null // รูปปกที่อัปโหลด = การ์ดในแท็บเท็มเพลตของ editor
  is_visible: boolean
}

const field = "px-3 py-2 rounded-lg bg-bg-base border border-white/10 text-[13px] text-text-base focus:outline-none focus:border-accent/50 min-w-0"
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"]
const previewSrc = (p: string) => (p.startsWith("data:") ? p : getImageUrl(p))

// รูป: ใช้สัดส่วนจริงเลือก canvas แนวตั้ง/แนวนอนให้ตรงกับรูป
async function imageOrientation(file: File): Promise<"portrait" | "landscape"> {
  const bmp = await createImageBitmap(file)
  const o = bmp.width > bmp.height ? "landscape" : "portrait"
  bmp.close()
  return o
}

export default function GameTemplatesClient({ templates }: { templates: TemplateRow[] }) {
  const t = useTranslations("Admin")
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [cover, setCover] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const api = async (method: "POST" | "PATCH" | "DELETE", body: object) => {
    const r = await fetch("/api/admin/livegen-templates", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    if (!r.ok) throw new Error((await r.json().catch(() => null))?.error ?? `HTTP ${r.status}`)
  }
  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setMsg(null)
    try { await fn(); router.refresh() }
    catch (e) { setMsg(`❌ ${e instanceof Error ? e.message : String(e)}`) }
    finally { setBusy(false) }
  }
  const closeForm = () => { setAdding(false); setName(""); setFile(null); setCover(null) }
  const uploadImage = async (f: File) => {
    const fd = new FormData()
    fd.append("file", f)
    fd.append("type", "image")
    const up = await fetch("/api/admin/upload", { method: "POST", body: fd })
    const d = await up.json().catch(() => null)
    if (!up.ok || !d?.url) throw new Error(d?.error ?? t("gt_bad_file"))
    return d.url as string
  }

  // รูป → อัปโหลดผ่าน /api/admin/upload ก่อน · .json → ต้องเป็นไฟล์ที่ปุ่ม "ไฟล์เท็มเพลต" ใน editor ส่งออก
  const add = () => run(async () => {
    if (!file || !name.trim()) return
    const cover_url = cover ? await uploadImage(cover) : null
    if (IMAGE_TYPES.includes(file.type)) {
      await api("POST", { name, kind: "image", image_url: await uploadImage(file), orientation: await imageOrientation(file), cover_url })
    } else {
      let tpl: { format?: string; orientation?: string; canvas_json?: unknown; thumbnail?: unknown } | null = null
      try { tpl = JSON.parse(await file.text()) } catch { /* ไม่ใช่ JSON */ }
      if (tpl?.format !== TEMPLATE_FILE_FORMAT) throw new Error(t("gt_bad_file"))
      await api("POST", { name, kind: "canvas", canvas_json: tpl.canvas_json, orientation: tpl.orientation, thumbnail: tpl.thumbnail, cover_url })
    }
    closeForm()
  })

  return (
    <div className="p-5 sm:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-text-base">{t("game_templates")}</h1>
          <p className="text-[13px] text-text-muted mt-1 max-w-2xl">{t("gt_desc")}</p>
        </div>
        {!adding && (
          <button onClick={() => setAdding(true)} className="px-4 py-2 rounded-lg bg-accent text-white text-[13px] font-semibold hover:opacity-90">
            + {t("gt_add")}
          </button>
        )}
      </div>

      {msg && <div className="text-[13px] px-4 py-2 rounded-lg bg-bg-card border border-hot/30">{msg}</div>}

      {adding && (
        <div className="bg-bg-card border border-accent/20 rounded-2xl p-5 space-y-3">
          <label className="block">
            <span className="text-[12px] text-text-muted">{t("gt_name")}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className={`${field} w-full mt-1`} />
          </label>
          <label className="block">
            <span className="text-[12px] text-text-muted">{t("gt_file")}</span>
            <input type="file" accept="image/png,image/jpeg,image/webp,.json,application/json"
                   onChange={(e) => {
                     const f = e.target.files?.[0] ?? null
                     setFile(f)
                     if (f && !name.trim()) setName(f.name.replace(/(\.template)?\.(json|png|jpe?g|webp)$/i, ""))
                   }}
                   className="block w-full mt-1 text-[13px] text-text-muted file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-accent/15 file:text-accent-light" />
            <span className="block text-[11px] text-text-dim mt-1">{t("gt_file_hint")}</span>
          </label>
          <label className="block">
            <span className="text-[12px] text-text-muted">{t("gt_cover")}</span>
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setCover(e.target.files?.[0] ?? null)}
                   className="block w-full mt-1 text-[13px] text-text-muted file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-accent/15 file:text-accent-light" />
            <span className="block text-[11px] text-text-dim mt-1">{t("gt_cover_hint")}</span>
          </label>
          <div className="flex gap-2 justify-end">
            <button onClick={closeForm} disabled={busy} className="px-4 py-2 rounded-lg border border-white/10 text-text-muted text-[13px] hover:text-text-base disabled:opacity-50">
              {t("cancel")}
            </button>
            <button onClick={() => void add()} disabled={busy || !file || !name.trim()}
                    className="px-4 py-2 rounded-lg bg-accent text-white text-[13px] font-semibold hover:opacity-90 disabled:opacity-50">
              {busy ? t("gt_uploading") : t("save")}
            </button>
          </div>
        </div>
      )}

      <div className="bg-bg-card border border-accent/10 rounded-2xl overflow-hidden">
        {templates.length === 0 ? (
          <p className="p-5 text-[13px] text-text-muted">{t("gt_empty")}</p>
        ) : (
          <div className="divide-y divide-white/5">
            {templates.map((x) => (
              <div key={x.id} className={`px-5 py-3 flex items-center gap-3 flex-wrap ${x.is_visible ? "" : "opacity-60"}`}>
                <div className={`${!x.cover && x.orientation === "landscape" ? "w-[72px] h-[40px]" : "w-[40px] h-[72px]"} rounded-md overflow-hidden bg-bg-base flex-shrink-0`}>
                  {(x.cover ?? x.preview) && <img src={previewSrc((x.cover ?? x.preview) as string)} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <input defaultValue={x.name} maxLength={80}
                         onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== x.name) void run(() => api("PATCH", { id: x.id, name: v })) }}
                         onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur() }}
                         className={`${field} w-full`} />
                  <p className="text-[11px] text-text-muted mt-1">
                    {x.kind === "canvas" ? t("gt_kind_canvas") : t("gt_kind_image")} · {x.orientation === "landscape" ? "16:9" : "9:16"}
                  </p>
                </div>
                <label className={`text-[12px] px-3 py-1.5 rounded-lg border border-white/15 text-text-muted hover:text-text-base cursor-pointer ${busy ? "opacity-50 pointer-events-none" : ""}`}>
                  {t("gt_cover_change")}
                  <input type="file" accept="image/png,image/jpeg,image/webp" hidden
                         onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void run(async () => api("PATCH", { id: x.id, cover_url: await uploadImage(f) })) }} />
                </label>
                <Link href={`/livegen?template=${x.id}`} target="_blank"
                      className="text-[12px] px-3 py-1.5 rounded-lg border border-accent/30 text-accent-light hover:bg-accent/10">
                  {t("gt_open")}
                </Link>
                <button onClick={() => void run(() => api("PATCH", { id: x.id, is_visible: !x.is_visible }))} disabled={busy}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${x.is_visible ? "bg-green-500" : "bg-white/15"} disabled:opacity-50`}
                        title={x.is_visible ? t("visible") : t("hidden")}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${x.is_visible ? "translate-x-4" : "translate-x-0.5"}`} />
                </button>
                <button onClick={() => { if (confirm(t("gt_delete_confirm", { name: x.name }))) void run(() => api("DELETE", { id: x.id })) }} disabled={busy}
                        className="text-[12px] px-2.5 py-1 rounded-lg border border-hot/30 text-hot hover:bg-hot/10 disabled:opacity-50">
                  {t("delete")}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
