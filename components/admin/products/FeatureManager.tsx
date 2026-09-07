"use client"

// แท็บ Feature ในหน้าแก้สินค้า — พิมพ์จุดเด่นเอง (TH/EN) เรียงลำดับได้ กดบันทึกทีเดียวทั้งชุด
// แสดงในหน้าสินค้าเป็นเช็คลิสต์ 2 คอลัมน์ในแท็บรายละเอียด
import { useState } from "react"
import { useTranslations } from "next-intl"

type Feature = { text_th: string; text_en: string }

export default function FeatureManager({ productId, features: initial }: {
  productId: string
  features: { text_th: string; text_en: string | null; sort_order: number }[]
}) {
  const t = useTranslations("AdminFeatures")
  const [items, setItems] = useState<Feature[]>(
    [...initial].sort((a, b) => a.sort_order - b.sort_order).map((f) => ({ text_th: f.text_th, text_en: f.text_en ?? "" })),
  )
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [dirty, setDirty] = useState(false)

  const update = (fn: (xs: Feature[]) => Feature[]) => { setItems(fn); setDirty(true); setMsg(null) }
  const move = (i: number, dir: -1 | 1) =>
    update((xs) => { const j = i + dir; if (j < 0 || j >= xs.length) return xs; const c = [...xs]; [c[i], c[j]] = [c[j], c[i]]; return c })

  const save = async () => {
    setSaving(true); setMsg(null)
    try {
      const r = await fetch(`/api/admin/products/${productId}/features`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items }),
      })
      if (!r.ok) throw new Error()
      const d = await r.json()
      setItems((d.features ?? []).map((f: { text_th: string; text_en: string | null }) => ({ text_th: f.text_th, text_en: f.text_en ?? "" })))
      setDirty(false)
      setMsg({ ok: true, text: t("saved") })
    } catch {
      setMsg({ ok: false, text: t("save_error") })
    } finally { setSaving(false) }
  }

  const input = "flex-1 min-w-0 px-3 py-2 rounded-lg border border-border-soft bg-bg-input text-text-base text-[13px] outline-none focus:border-accent transition-colors placeholder:text-text-dim"
  const iconBtn = "w-8 h-8 rounded-lg border border-border-soft text-text-muted hover:text-text-base hover:bg-white/[0.04] flex items-center justify-center transition disabled:opacity-30 shrink-0"

  return (
    <div className="bg-bg-card border border-accent/10 rounded-2xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-[15px] font-bold text-text-base">{t("title")}</h3>
          <p className="text-[12px] text-text-muted mt-0.5">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          {msg && <span className={`text-[12px] ${msg.ok ? "text-success" : "text-hot"}`}>{msg.text}</span>}
          <button onClick={save} disabled={saving || !dirty}
                  className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-light text-white text-[13px] font-semibold transition disabled:opacity-50">
            {saving ? t("saving") : t("save")}
          </button>
        </div>
      </div>

      {items.length === 0 && <p className="text-[13px] text-text-dim">{t("empty")}</p>}

      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-6 text-center text-[12px] text-text-dim shrink-0">{i + 1}</span>
            <input value={it.text_th} placeholder={t("placeholder_th")} className={input}
                   onChange={(e) => update((xs) => xs.map((x, k) => (k === i ? { ...x, text_th: e.target.value } : x)))} />
            <input value={it.text_en} placeholder={t("placeholder_en")} className={input}
                   onChange={(e) => update((xs) => xs.map((x, k) => (k === i ? { ...x, text_en: e.target.value } : x)))} />
            <button onClick={() => move(i, -1)} disabled={i === 0} className={iconBtn} title={t("move_up")}>↑</button>
            <button onClick={() => move(i, 1)} disabled={i === items.length - 1} className={iconBtn} title={t("move_down")}>↓</button>
            <button onClick={() => update((xs) => xs.filter((_, k) => k !== i))} className={`${iconBtn} hover:!text-hot`} title={t("remove")}>×</button>
          </div>
        ))}
      </div>

      <button onClick={() => update((xs) => [...xs, { text_th: "", text_en: "" }])}
              className="w-full py-2.5 rounded-lg border border-dashed border-border-light text-accent-light text-[13px] font-semibold hover:bg-accent/[0.05] transition">
        + {t("add")}
      </button>
      <p className="text-[11px] text-text-dim">{t("hint")}</p>
    </div>
  )
}
