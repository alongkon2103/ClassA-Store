"use client"

// แก้ไขเกม Maki: ชื่อ TH/EN · คำอธิบาย · ราคาขายต่อแพลน (≥ ขั้นต่ำสด) · เปิด/ปิดแสดง
// รูปปก/แบนเนอร์/วิดีโอดึงจาก Maki อัตโนมัติตอน sync (API v1.1) — ไม่ต้องอัปโหลดเอง โชว์ให้ดูเฉย ๆ
import { useState } from "react"
import { useTranslations } from "next-intl"
import { getImageUrl } from "@/lib/getImageUrl"

export type MakiPlanView = { key: string; plan: "1m" | "perma"; label_th: string; label_en: string; min_price_thb: number; sell_price_thb: number | null; preset_link: string | null }
export type MakiProductView = {
  id: string; external_slug: string; name_th: string; name_en: string
  description_html_th: string | null; description_html_en: string | null
  thumbnail_url: string | null; is_visible: boolean; coming_soon: boolean; plans: MakiPlanView[]
}

export default function MakiProductEditor({ product, onClose, onSaved }: { product: MakiProductView; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("AdminMaki")
  const [nameTh, setNameTh] = useState(product.name_th)
  const [nameEn, setNameEn] = useState(product.name_en)
  const [descTh, setDescTh] = useState(product.description_html_th ?? "")
  const [descEn, setDescEn] = useState(product.description_html_en ?? "")
  const [prices, setPrices] = useState<Record<string, string>>(Object.fromEntries(product.plans.map((p) => [p.key, p.sell_price_thb == null ? "" : String(p.sell_price_thb)])))
  const [visible, setVisible] = useState(product.is_visible)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const save = async () => {
    setSaving(true); setMsg(null)
    try {
      const sell_prices: Record<string, number | null> = {}
      for (const p of product.plans) sell_prices[p.key] = prices[p.key] === "" ? null : Number(prices[p.key])
      const r = await fetch(`/api/admin/partner-store/products/${product.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name_th: nameTh, name_en: nameEn, description_html_th: descTh, description_html_en: descEn, sell_prices, is_visible: visible }),
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

        {/* แสดงในร้าน */}
        <label className="flex items-center gap-2.5 text-[13px] text-text-base">
          <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} className="accent-accent w-4 h-4" />
          {t("visible")}
          <span className="text-[11px] text-text-dim">— {t("visible_hint")}</span>
        </label>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-soft">
          {msg && <span className={`text-[12px] mr-auto ${msg.ok ? "text-success" : "text-hot"}`}>{msg.text}</span>}
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-border-soft text-text-muted text-[13px] hover:text-text-base transition">{t("cancel")}</button>
          <button onClick={save} disabled={saving || belowMin} className="px-5 py-2 rounded-lg bg-accent hover:bg-accent-light text-white text-[13px] font-semibold transition disabled:opacity-50">
            {saving ? t("saving") : t("save")}
          </button>
        </div>
      </div>
    </div>
  )
}
