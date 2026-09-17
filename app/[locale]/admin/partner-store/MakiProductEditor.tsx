"use client"

// แก้ไขเกม Maki: ชื่อ TH/EN · คำอธิบาย · ราคาขายต่อแพลน (≥ ขั้นต่ำสด) · โปรแกรมที่ต้องโหลด (ชื่อ+ลิงก์ โชว์ในหน้าออเดอร์หลังจ่าย) · วิดีโอ YouTube หลังซื้อ · รูปฟังก์ชันสำหรับหน้าสร้างรูปไลฟ์ · เปิด/ปิดแสดง
// รูปปก/แบนเนอร์/วิดีโอดึงจาก Maki อัตโนมัติตอน sync (API v1.1) — ไม่ต้องอัปโหลดเอง โชว์ให้ดูเฉย ๆ
import { useState } from "react"
import { useTranslations } from "next-intl"
import { getImageUrl } from "@/lib/getImageUrl"
import type { MakiDownload, MakiGuideVideo, MakiLivegenFunction } from "@/lib/maki"
import { youtubeId } from "@/lib/video"

export type MakiPlanView = { key: string; plan: "1m" | "perma"; label_th: string; label_en: string; min_price_thb: number; sell_price_thb: number | null; preset_link: string | null }
export type MakiProductView = {
  id: string; external_slug: string; name_th: string; name_en: string
  description_html_th: string | null; description_html_en: string | null
  thumbnail_url: string | null; is_visible: boolean; coming_soon: boolean; plans: MakiPlanView[]
  downloads: MakiDownload[]
  guide_videos: MakiGuideVideo[]
  livegen_functions: MakiLivegenFunction[]
}

export default function MakiProductEditor({ product, onClose, onSaved }: { product: MakiProductView; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("AdminMaki")
  const [nameTh, setNameTh] = useState(product.name_th)
  const [nameEn, setNameEn] = useState(product.name_en)
  const [descTh, setDescTh] = useState(product.description_html_th ?? "")
  const [descEn, setDescEn] = useState(product.description_html_en ?? "")
  const [prices, setPrices] = useState<Record<string, string>>(Object.fromEntries(product.plans.map((p) => [p.key, p.sell_price_thb == null ? "" : String(p.sell_price_thb)])))
  const [visible, setVisible] = useState(product.is_visible)
  const [downloads, setDownloads] = useState<MakiDownload[]>(product.downloads)
  const [videos, setVideos] = useState<MakiGuideVideo[]>(product.guide_videos)
  const [functions, setFunctions] = useState<MakiLivegenFunction[]>(product.livegen_functions)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const save = async () => {
    setSaving(true); setMsg(null)
    try {
      const sell_prices: Record<string, number | null> = {}
      for (const p of product.plans) sell_prices[p.key] = prices[p.key] === "" ? null : Number(prices[p.key])
      const r = await fetch(`/api/admin/partner-store/products/${product.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name_th: nameTh, name_en: nameEn, description_html_th: descTh, description_html_en: descEn, sell_prices, is_visible: visible, downloads, guide_videos: videos, livegen_functions: functions }),
      })
      if (r.ok) { setMsg({ ok: true, text: t("saved") }); onSaved() }
      else {
        const d = await r.json().catch(() => ({}))
        if (d.error === "below_min") setMsg({ ok: false, text: t("below_min", { list: d.details.map((x: { key: string; min: number }) => `${x.key} ≥ ฿${x.min.toLocaleString()}`).join(", ") }) })
        else setMsg({ ok: false, text: t("save_error") })
      }
    } finally { setSaving(false) }
  }

  const input = "w-full px-3 py-2 rounded-lg border border-border-soft bg-bg-input text-text-base text-[13px] outline-none focus:border-accent transition-colors placeholder:text-text-dim"
  const label = "block text-[11px] font-semibold text-text-dim uppercase tracking-[0.04em] mb-1"
  const belowMin = product.plans.some((p) => prices[p.key] !== "" && Number(prices[p.key]) < p.min_price_thb)
  const isBadDownload = (d: MakiDownload) => !d.name.trim() || !/^https?:\/\/\S+$/.test(d.url.trim())
  const badDownload = downloads.some(isBadDownload)
  const isBadVideo = (v: MakiGuideVideo) => !/^https?:\/\//.test(v.url.trim()) || !youtubeId(v.url.trim())
  const badVideo = videos.some(isBadVideo)
  const badFunction = functions.some((f) => !f.name.trim())
  const MAX_FUNCTIONS = 60

  // อัปโหลดรูปฟังก์ชันทีละหลายไฟล์ → แต่ละรูปเป็น 1 แถว ตั้งชื่อเริ่มต้นจากชื่อไฟล์ (แก้ได้) · บันทึกจริงตอนกด "บันทึก"
  const uploadFunctions = async (files: File[]) => {
    const room = MAX_FUNCTIONS - functions.length
    if (!files.length || room <= 0) return
    setUploading(true); setMsg(null)
    try {
      for (const file of files.slice(0, room)) {
        const fd = new FormData()
        fd.append("file", file)
        fd.append("type", "image")
        const r = await fetch("/api/admin/upload", { method: "POST", body: fd })
        const d = await r.json().catch(() => null)
        if (!r.ok || !d?.url) { setMsg({ ok: false, text: t("lg_upload_error", { error: d?.error ?? String(r.status) }) }); continue }
        setFunctions((xs) => [...xs, { name: file.name.replace(/\.[a-z0-9]+$/i, "").slice(0, 80), image_url: d.url }])
      }
    } finally { setUploading(false) }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: "var(--color-overlay)" }} onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto custom-scrollbar bg-bg-card border border-border-soft rounded-2xl p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-[15px] font-bold text-text-base">{t("edit_title")}: {product.name_en}</h3>
            <p className="text-[12px] text-text-muted mt-0.5">{t("edit_sub")}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg text-text-dim hover:text-text-base hover:bg-white/[0.04] flex items-center justify-center">×</button>
        </div>

        {/* สื่อจาก Maki (อ่านอย่างเดียว) */}
        <div className="flex items-center gap-3 rounded-xl border border-border-soft bg-bg-input/40 p-3">
          <div className="w-20 h-12 rounded-lg overflow-hidden shrink-0" style={{ background: "var(--gradient-thumb)" }}>
            {product.thumbnail_url && <img src={getImageUrl(product.thumbnail_url)} alt="" className="w-full h-full object-cover" />}
          </div>
          <p className="text-[11px] text-text-dim leading-relaxed">{t("media_from_maki")}</p>
        </div>

        {/* ชื่อ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><span className={label}>{t("name_th")}</span><input value={nameTh} onChange={(e) => setNameTh(e.target.value)} className={input} /></div>
          <div><span className={label}>{t("name_en")}</span><input value={nameEn} onChange={(e) => setNameEn(e.target.value)} className={input} /></div>
        </div>

        {/* คำอธิบาย */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><span className={label}>{t("desc_th")}</span><textarea value={descTh} onChange={(e) => setDescTh(e.target.value)} rows={5} className={input} placeholder={t("desc_hint")} /></div>
          <div><span className={label}>{t("desc_en")}</span><textarea value={descEn} onChange={(e) => setDescEn(e.target.value)} rows={5} className={input} placeholder={t("desc_hint")} /></div>
        </div>

        {/* ราคาขายต่อแพลน */}
        <div>
          <span className={label}>{t("prices")}</span>
          <div className="space-y-2">
            {product.plans.map((p) => {
              const v = prices[p.key]
              const bad = v !== "" && Number(v) < p.min_price_thb
              const margin = v === "" ? null : Number(v) - p.min_price_thb
              return (
                <div key={p.key} className={`flex flex-wrap items-center gap-3 px-3 py-2.5 rounded-lg border ${bad ? "border-hot/50 bg-hot/5" : "border-border-soft bg-bg-base/40"}`}>
                  <div className="min-w-[140px]">
                    <p className="text-[13px] font-semibold text-text-base">{p.label_th} <span className="text-text-dim font-normal">/ {p.label_en}</span></p>
                    <p className="text-[11px] text-text-dim font-mono">{p.key}</p>
                  </div>
                  <div className="text-[12px] text-text-muted">{t("min")}: <span className="font-bold text-text-base">฿{p.min_price_thb.toLocaleString()}</span></div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[12px] text-text-muted">{t("sell")}</span>
                    <input type="number" min={p.min_price_thb} value={v} placeholder={String(p.min_price_thb)}
                           onChange={(e) => setPrices((m) => ({ ...m, [p.key]: e.target.value }))}
                           className={`${input} !w-[120px]`} />
                  </div>
                  {margin != null && !bad && <span className="text-[12px] text-success">{t("margin")} ฿{margin.toLocaleString()}</span>}
                  {bad && <span className="text-[12px] text-hot">{t("below_min_short")}</span>}
                  {v === "" && <span className="text-[12px] text-text-dim">{t("not_for_sale")}</span>}
                </div>
              )
            })}
          </div>
          <p className="text-[11px] text-text-dim mt-1.5">{t("prices_hint")}</p>
        </div>

        {/* โปรแกรมที่ต้องโหลด — โชว์เป็นปุ่มดาวน์โหลดในหน้าออเดอร์หลังชำระเงินสำเร็จ */}
        <div>
          <span className={label}>{t("downloads")}</span>
          <div className="space-y-2">
            {downloads.map((d, i) => (
              <div key={i} className={`flex flex-col sm:flex-row gap-2 px-3 py-2.5 rounded-lg border ${isBadDownload(d) ? "border-hot/50 bg-hot/5" : "border-border-soft bg-bg-base/40"}`}>
                <input value={d.name} maxLength={80} placeholder={t("download_name")}
                       onChange={(e) => setDownloads((xs) => xs.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} className={`${input} sm:!w-[200px]`} />
                <input value={d.url} maxLength={500} placeholder={t("download_url")}
                       onChange={(e) => setDownloads((xs) => xs.map((x, k) => (k === i ? { ...x, url: e.target.value } : x)))} className={`${input} font-mono !text-[12px]`} />
                <button onClick={() => setDownloads((xs) => xs.filter((_, k) => k !== i))} className="shrink-0 px-3 py-2 rounded-lg border border-hot/30 text-hot text-[12px] hover:bg-hot/10 transition">{t("remove")}</button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <button onClick={() => setDownloads((xs) => [...xs, { name: "", url: "" }])} disabled={downloads.length >= 20}
                    className="px-3 py-1.5 rounded-lg border border-accent/40 text-accent-light text-[12px] font-semibold hover:bg-accent/10 transition disabled:opacity-50">+ {t("add_download")}</button>
            <span className="text-[11px] text-text-dim">{t("downloads_hint")}</span>
          </div>
          {badDownload && <p className="text-[11px] text-hot mt-1">{t("download_invalid")}</p>}
        </div>

        {/* วิดีโอ YouTube — โชว์ในหน้าออเดอร์หลังชำระเงินสำเร็จ (เช่น วิธีติดตั้ง/วิธีใช้) */}
        <div>
          <span className={label}>{t("videos")}</span>
          <div className="space-y-2">
            {videos.map((v, i) => (
              <div key={i} className={`flex flex-col sm:flex-row gap-2 px-3 py-2.5 rounded-lg border ${isBadVideo(v) ? "border-hot/50 bg-hot/5" : "border-border-soft bg-bg-base/40"}`}>
                <input value={v.title} maxLength={80} placeholder={t("video_title")}
                       onChange={(e) => setVideos((xs) => xs.map((x, k) => (k === i ? { ...x, title: e.target.value } : x)))} className={`${input} sm:!w-[200px]`} />
                <input value={v.url} maxLength={300} placeholder={t("video_url")}
                       onChange={(e) => setVideos((xs) => xs.map((x, k) => (k === i ? { ...x, url: e.target.value } : x)))} className={`${input} font-mono !text-[12px]`} />
                <button onClick={() => setVideos((xs) => xs.filter((_, k) => k !== i))} className="shrink-0 px-3 py-2 rounded-lg border border-hot/30 text-hot text-[12px] hover:bg-hot/10 transition">{t("remove")}</button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <button onClick={() => setVideos((xs) => [...xs, { title: "", url: "" }])} disabled={videos.length >= 20}
                    className="px-3 py-1.5 rounded-lg border border-accent/40 text-accent-light text-[12px] font-semibold hover:bg-accent/10 transition disabled:opacity-50">+ {t("add_video")}</button>
            <span className="text-[11px] text-text-dim">{t("videos_hint")}</span>
          </div>
          {badVideo && <p className="text-[11px] text-hot mt-1">{t("video_invalid")}</p>}
        </div>

        {/* รูปฟังก์ชันสำหรับหน้าสร้างรูปไลฟ์ — ลูกค้าเลือกไปวางเองในแท็บ "ฟังก์ชัน" */}
        <div>
          <span className={label}>{t("lg_functions")} ({functions.length}/{MAX_FUNCTIONS})</span>
          {functions.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
              {functions.map((f, i) => (
                <div key={f.image_url} className={`rounded-lg border p-2 flex flex-col gap-1.5 ${f.name.trim() ? "border-border-soft bg-bg-base/40" : "border-hot/50 bg-hot/5"}`}>
                  <div className="aspect-square rounded-md overflow-hidden" style={{ background: "var(--gradient-thumb)" }}>
                    <img src={getImageUrl(f.image_url)} alt="" className="w-full h-full object-contain" />
                  </div>
                  <input value={f.name} maxLength={80} placeholder={t("lg_name")}
                         onChange={(e) => setFunctions((xs) => xs.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} className={`${input} !py-1.5 !text-[12px]`} />
                  <button onClick={() => setFunctions((xs) => xs.filter((_, k) => k !== i))} className="self-end text-[11px] text-hot hover:underline">{t("remove")}</button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-3 flex-wrap">
            <label className={`px-3 py-1.5 rounded-lg border border-accent/40 text-accent-light text-[12px] font-semibold hover:bg-accent/10 transition cursor-pointer ${uploading || functions.length >= MAX_FUNCTIONS ? "opacity-50 pointer-events-none" : ""}`}>
              + {uploading ? t("lg_uploading") : t("lg_upload")}
              <input type="file" accept="image/png,image/jpeg,image/webp" multiple hidden
                     onChange={(e) => { const fs = Array.from(e.target.files ?? []); e.target.value = ""; void uploadFunctions(fs) }} />
            </label>
            <span className="text-[11px] text-text-dim">{t("lg_functions_hint")}</span>
          </div>
          {badFunction && <p className="text-[11px] text-hot mt-1">{t("lg_name_required")}</p>}
        </div>

        {/* แสดงในร้าน */}
        <label className="flex items-center gap-2.5 text-[13px] text-text-base">
          <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} className="accent-accent w-4 h-4" />
          {t("visible")}
          <span className="text-[11px] text-text-dim">— {t("visible_hint")}</span>
        </label>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-soft">
          {msg && <span className={`text-[12px] mr-auto ${msg.ok ? "text-success" : "text-hot"}`}>{msg.text}</span>}
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-border-soft text-text-muted text-[13px] hover:text-text-base transition">{t("cancel")}</button>
          <button onClick={save} disabled={saving || uploading || belowMin || badDownload || badVideo || badFunction} className="px-5 py-2 rounded-lg bg-accent hover:bg-accent-light text-white text-[13px] font-semibold transition disabled:opacity-50">
            {saving ? t("saving") : t("save")}
          </button>
        </div>
      </div>
    </div>
  )
}
