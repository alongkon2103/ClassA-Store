"use client"

import { useEffect, useState } from "react"
import { useLocale } from "next-intl"

type Candidate = { id: string; name_th: string; name_en: string; type: string; is_active: boolean; is_consignment: boolean | null }

export default function BundleGamesManager({ value, onChange, productId }: {
  value: string[]
  onChange: (ids: string[]) => void
  productId?: string
}) {
  const th = useLocale() === "th"
  const [games, setGames] = useState<Candidate[]>([])
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    fetch("/api/admin/products", { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error("Could not load games")
        const rows: Candidate[] = await response.json()
        setGames(rows.filter(game => game.id !== productId && game.is_active && !game.is_consignment && ["roblox_whitelist", "desktop_program"].includes(game.type)))
      })
      .catch(error => { if (error.name !== "AbortError") setError(true) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [productId, retry])
  const missing = !loading && !error ? value.filter(id => !games.some(game => game.id === id)) : []
  const visible = games.filter(game => `${game.name_th} ${game.name_en}`.toLowerCase().includes(query.toLowerCase()))
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter(current => current !== id) : [...value, id])
  return <section className="space-y-4 rounded-2xl border border-accent/20 bg-bg-card p-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="font-semibold">{th ? "เกมในชุด" : "Included games"}</h2>
      <span className="text-sm text-text-muted">{value.length} / 50</span>
    </div>
    <p className="text-sm text-text-muted">{th ? "เลือกเกม AC ที่เปิดใช้งาน 2–50 เกม ทุกเกมได้รับระยะเวลาเดียวกันตามแพ็กเกจที่ลูกค้าซื้อ แก้ไขชุดนี้ไม่เปลี่ยนสิทธิ์ของคำสั่งซื้อเดิม" : "Choose 2–50 active AC games. Every included game receives the duration of the purchased package. Editing this set does not change existing purchases."}</p>
    <input aria-label={th ? "ค้นหาเกมในชุด" : "Search bundle games"} placeholder={th ? "ค้นหาชื่อเกม..." : "Search game names..."} value={query} onChange={event => setQuery(event.target.value)} className="w-full rounded-xl border border-accent/20 bg-bg-input px-4 py-2.5 text-sm" />
    {loading && <p className="text-sm text-text-muted">{th ? "กำลังโหลดเกม..." : "Loading games..."}</p>}
    {error && <div className="text-sm text-red-400">{th ? "โหลดเกมไม่สำเร็จ" : "Could not load games"} <button type="button" onClick={() => { setLoading(true); setError(false); setRetry(current => current + 1) }} className="underline">{th ? "ลองอีกครั้ง" : "Retry"}</button></div>}
    {missing.map(id => <div key={id} className="flex items-center justify-between gap-3 rounded-xl border border-red-400/30 p-3 text-sm"><span className="break-all text-red-400">{th ? "เกมไม่พร้อมใช้งาน: " : "Unavailable game: "}{id}</span><button type="button" onClick={() => toggle(id)} className="shrink-0 underline">{th ? "นำออก" : "Remove"}</button></div>)}
    {!loading && !error && <div className="max-h-96 space-y-2 overflow-y-auto">
      {visible.map(game => <label key={game.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${value.includes(game.id) ? "border-accent/50 bg-accent/10" : "border-white/10"}`}>
        <input type="checkbox" checked={value.includes(game.id)} disabled={!value.includes(game.id) && value.length >= 50} onChange={() => toggle(game.id)} className="h-4 w-4 accent-accent" />
        <span className="min-w-0 flex-1 text-sm">{th ? game.name_th || game.name_en : game.name_en || game.name_th}</span>
        <span className="text-xs text-text-muted">{game.type === "desktop_program" ? "Desktop" : "Roblox"}</span>
      </label>)}
      {visible.length === 0 && <p className="text-sm text-text-muted">{th ? "ไม่พบเกมที่เลือกได้" : "No eligible games found"}</p>}
    </div>}
    {value.length < 2 && <p className="text-sm text-amber-400">{th ? "ต้องเลือกอย่างน้อย 2 เกมก่อนบันทึก" : "Select at least 2 games before saving."}</p>}
  </section>
}
