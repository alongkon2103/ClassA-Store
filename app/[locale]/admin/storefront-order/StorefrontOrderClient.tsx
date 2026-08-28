"use client"

import { useState } from "react"
import { Reorder } from "framer-motion"
import { useTranslations, useLocale } from "next-intl"
import { getImageUrl } from "@/lib/getImageUrl"

type Item = {
  key: string; type: "product" | "partner"; id: string
  name_th: string; name_en: string; thumb: string | null; is_partner: boolean
}

export default function StorefrontOrderClient({ items }: { items: Item[] }) {
  const t = useTranslations("Admin")
  const locale = useLocale()
  const [list, setList] = useState<Item[]>(items)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  const onReorder = (next: Item[]) => { setList(next); setDirty(true); setMsg(null) }

  const save = async () => {
    setSaving(true); setMsg(null)
    try {
      const r = await fetch("/api/admin/storefront-order", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: list.map((x) => ({ type: x.type, id: x.id })) }),
      })
      if (r.ok) { setMsg(`✅ ${t("order_saved")}`); setDirty(false) }
      else setMsg(`❌ ${t("save")} — HTTP ${r.status}`)
    } catch (e) {
      setMsg(`❌ ${e instanceof Error ? e.message : "failed"}`)
    } finally { setSaving(false) }
  }

  return (
    <div className="p-5 sm:p-8 max-w-3xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-text-base">{t("storefront_order")}</h1>
          <p className="text-[13px] text-text-muted mt-1">{t("storefront_order_desc")}</p>
        </div>
        <button onClick={save} disabled={saving || !dirty}
          className="px-5 py-2.5 rounded-lg bg-accent text-white text-[14px] font-semibold hover:opacity-90 disabled:opacity-40">
          {saving ? "..." : t("save")}
        </button>
      </div>

      {msg && <div className="text-[13px] px-4 py-2 rounded-lg bg-bg-card border border-accent/10">{msg}</div>}

      <Reorder.Group axis="y" values={list} onReorder={onReorder} className="space-y-2">
        {list.map((item, i) => (
          <Reorder.Item key={item.key} value={item}
            className="flex items-center gap-3 bg-bg-card border border-accent/10 rounded-xl p-2.5 cursor-grab active:cursor-grabbing select-none">
            <span className="text-text-muted text-[13px] w-6 text-center tabular-nums">{i + 1}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-muted flex-shrink-0">
              <circle cx="9" cy="6" r="1" /><circle cx="15" cy="6" r="1" />
              <circle cx="9" cy="12" r="1" /><circle cx="15" cy="12" r="1" />
              <circle cx="9" cy="18" r="1" /><circle cx="15" cy="18" r="1" />
            </svg>
            {item.thumb
              ? <img src={item.is_partner ? item.thumb : getImageUrl(item.thumb)} alt="" className="w-14 h-9 rounded object-cover flex-shrink-0" />
              : <div className="w-14 h-9 rounded bg-accent/20 flex-shrink-0" />}
            <span className="text-[13px] text-text-base font-medium flex-1 line-clamp-1">
              {locale === "th" ? item.name_th : item.name_en}
            </span>
            {item.is_partner
              ? <span className="text-[10px] font-bold uppercase bg-violet-500 text-white px-2 py-0.5 rounded-full">Partner</span>
              : <span className="text-[10px] font-semibold text-text-muted bg-white/5 px-2 py-0.5 rounded-full">{t("our_store")}</span>}
          </Reorder.Item>
        ))}
      </Reorder.Group>
    </div>
  )
}
