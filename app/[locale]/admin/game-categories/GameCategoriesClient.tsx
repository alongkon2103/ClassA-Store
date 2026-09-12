"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations, useLocale } from "next-intl"
import { getImageUrl } from "@/lib/getImageUrl"

export type CatRow = { id: string; name_th: string; name_en: string; is_visible: boolean; count: number }
export type GameRow = {
  kind: "product" | "partner"; id: string; name_th: string; name_en: string
  thumb: string | null
  source: string | null // null = เกม A Class · อื่นๆ = ชื่อร้านพาร์ทเนอร์
  listed: boolean // แสดงอยู่ในหน้าร้านตอนนี้ไหม (เกมที่ยังไม่แสดงก็ใส่หมวดไว้ก่อนได้)
  category_id: string | null
}

const field = "px-3 py-1.5 rounded-lg bg-bg-base border border-white/10 text-[13px] text-text-base focus:outline-none focus:border-accent/50 min-w-0"

export default function GameCategoriesClient({ cats, games }: { cats: CatRow[]; games: GameRow[] }) {
  const t = useTranslations("Admin")
  const isTH = useLocale() === "th"
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [newTh, setNewTh] = useState("")
  const [newEn, setNewEn] = useState("")

  const call = async (method: "POST" | "PATCH" | "PUT" | "DELETE", body: object) => {
    setBusy(true); setMsg(null)
    try {
      const r = await fetch("/api/admin/game-categories", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      if (!r.ok) { setMsg(`❌ ${(await r.json().catch(() => null))?.error ?? `HTTP ${r.status}`}`); return false }
      router.refresh()
      return true
    } finally { setBusy(false) }
  }

  const add = async () => {
    if (!newTh.trim() && !newEn.trim()) return
    if (await call("POST", { name_th: newTh, name_en: newEn })) { setNewTh(""); setNewEn("") }
  }
  // เลื่อนขึ้น/ลง = ส่งลำดับใหม่ทั้งชุด (server ตั้ง sort_order = ตำแหน่ง)
  const move = (i: number, j: number) => {
    const ids = cats.map((c) => c.id)
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    call("PATCH", { order: ids })
  }
  const rename = (c: CatRow, key: "name_th" | "name_en", value: string) => {
    const v = value.trim()
    if (v && v !== c[key]) call("PATCH", { id: c.id, [key]: v })
  }
  const label = (c: { name_th: string; name_en: string }) => (isTH ? c.name_th : c.name_en) || c.name_th
  // แก้ชื่อหมวด: บันทึกตอนออกจากช่อง หรือกด Enter
  const blurOnEnter = (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === "Enter") e.currentTarget.blur() }

  return (
    <div className="p-5 sm:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-text-base">{t("game_categories")}</h1>
        <p className="text-[13px] text-text-muted mt-1">{t("game_categories_desc")}</p>
      </div>

      {msg && <div className="text-[13px] px-4 py-2 rounded-lg bg-bg-card border border-hot/30">{msg}</div>}

      {/* ── หมวดทั้งหมด ── */}
      <div className="bg-bg-card border border-accent/10 rounded-2xl overflow-hidden">
        <div className="divide-y divide-white/5">
          {cats.length === 0 && (
            <div className="px-5 py-4 flex items-center justify-between gap-3 flex-wrap">
              <p className="text-[13px] text-text-muted">{t("cat_empty")}</p>
              <button onClick={() => call("POST", { action: "starter" })} disabled={busy}
                className="px-4 py-2 rounded-lg border border-accent/40 text-accent-light text-[13px] font-semibold hover:bg-accent/10 disabled:opacity-50">
                {t("cat_starter")}
              </button>
            </div>
          )}

          {cats.map((c, i) => (
            <div key={c.id} className={`px-5 py-3 flex items-center gap-2 flex-wrap ${c.is_visible ? "" : "opacity-60"}`}>
              <div className="flex flex-col">
                <button onClick={() => move(i, i - 1)} disabled={busy || i === 0} title={t("cat_move_up")}
                  className="px-1 text-[10px] leading-none text-text-muted hover:text-text-base disabled:opacity-30">▲</button>
                <button onClick={() => move(i, i + 1)} disabled={busy || i === cats.length - 1} title={t("cat_move_down")}
                  className="px-1 text-[10px] leading-none text-text-muted hover:text-text-base disabled:opacity-30">▼</button>
              </div>
              <input defaultValue={c.name_th} onBlur={(e) => rename(c, "name_th", e.target.value)} onKeyDown={blurOnEnter} placeholder={t("cat_name_th")} className={`${field} flex-1`} />
              <input defaultValue={c.name_en} onBlur={(e) => rename(c, "name_en", e.target.value)} onKeyDown={blurOnEnter} placeholder={t("cat_name_en")} className={`${field} flex-1`} />
              <span className="text-[11px] text-text-muted w-14 text-right">{t("cat_count", { count: c.count })}</span>
              <button onClick={() => call("PATCH", { id: c.id, is_visible: !c.is_visible })} disabled={busy}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${c.is_visible ? "bg-green-500" : "bg-white/15"} disabled:opacity-50`}
                title={c.is_visible ? t("visible") : t("hidden")}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${c.is_visible ? "translate-x-4" : "translate-x-0.5"}`} />
              </button>
              <button onClick={() => { if (confirm(t("cat_delete_confirm", { name: label(c) }))) call("DELETE", { id: c.id }) }} disabled={busy}
                className="text-[12px] px-2.5 py-1 rounded-lg border border-hot/30 text-hot hover:bg-hot/10 disabled:opacity-50">
                {t("delete")}
              </button>
            </div>
          ))}

          <div className="px-5 py-3 flex items-center gap-2 flex-wrap bg-bg-base/30">
            <input value={newTh} onChange={(e) => setNewTh(e.target.value)} placeholder={t("cat_name_th")} className={`${field} flex-1`} />
            <input value={newEn} onChange={(e) => setNewEn(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add() }} placeholder={t("cat_name_en")} className={`${field} flex-1`} />
            <button onClick={add} disabled={busy || (!newTh.trim() && !newEn.trim())}
              className="px-4 py-1.5 rounded-lg bg-accent text-white text-[13px] font-semibold hover:opacity-90 disabled:opacity-50">
              {t("cat_add")}
            </button>
          </div>
        </div>
      </div>

      {/* ── ใส่หมวดให้เกม (เกมเรา + เกมพาร์ทเนอร์ในรายการเดียว) ── */}
      <div className="bg-bg-card border border-accent/10 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-white/5">
          <p className="text-[15px] font-bold text-text-base">{t("cat_assign")}</p>
          <p className="text-[12px] text-text-muted mt-1">{t("cat_assign_hint")}</p>
        </div>
        <div className="divide-y divide-white/5">
          {games.map((g) => (
            <div key={`${g.kind}:${g.id}`} className={`px-5 py-2.5 flex items-center gap-3 ${g.listed ? "" : "opacity-60"}`}>
              {g.thumb
                ? <img src={getImageUrl(g.thumb)} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                : <div className="w-10 h-10 rounded-lg bg-accent/20 flex-shrink-0" />}
              <div className="min-w-0 flex-1">
                <p className="text-[13px] text-text-base font-medium truncate">{label(g)}</p>
                <p className="text-[11px] text-text-muted">
                  <span className={g.source ? "text-violet-300" : "text-accent-light"}>{g.source ?? t("cat_ours")}</span>
                  {!g.listed && <span> · {t("cat_not_listed")}</span>}
                </p>
              </div>
              <select value={g.category_id ?? ""} disabled={busy}
                onChange={(e) => call("PUT", { kind: g.kind, id: g.id, category_id: e.target.value || null })}
                className={`${field} w-44`}>
                <option value="">{t("cat_none")}</option>
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>{label(c)}{c.is_visible ? "" : ` (${t("hidden")})`}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
