"use client"
import { useState } from "react"
import { useTranslations } from "next-intl"
export default function TikkiesMapping({ productId, universeId, placeIds }: { productId: string; universeId: string | null; placeIds: string[] }) {
  const t = useTranslations("TikkiesAdmin")
  const [universe, setUniverse] = useState(universeId ?? ""), [places, setPlaces] = useState(placeIds.join("\n"))
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("")
  const save = async () => {
    setBusy(true); setMessage("")
    try {
      const response = await fetch(`/api/admin/products/${productId}/tikkies`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ universeId: universe.trim() || null, placeIds: places.split(/[\s,]+/).filter(Boolean) }) })
      setMessage(response.ok ? t("saved") : t("error"))
    } catch { setMessage(t("error")) } finally { setBusy(false) }
  }
  const input = "w-full bg-bg-input border border-border-soft rounded-lg p-3 text-sm text-text-base"
  return <section className="mt-6 rounded-xl border border-border-soft bg-bg-card p-5 space-y-4">
    <div><h2 className="text-lg font-bold">{t("title")}</h2><p className="text-sm text-text-muted mt-1">{t("help")}</p></div>
    <label className="block text-sm">Game Key<input readOnly value={productId} className={`${input} mt-1 font-mono`} /></label>
    <label className="block text-sm">Roblox Universe ID<input value={universe} onChange={e => setUniverse(e.target.value)} inputMode="numeric" className={`${input} mt-1`} /></label>
    <label className="block text-sm">Roblox Place IDs<textarea value={places} onChange={e => setPlaces(e.target.value)} rows={3} className={`${input} mt-1 font-mono`} /><span className="text-xs text-text-muted">{t("places_help")}</span></label>
    <div className="flex flex-wrap items-center gap-3"><button onClick={save} disabled={busy} className="shrink-0 whitespace-nowrap rounded-lg px-4 py-2 bg-accent text-white font-semibold disabled:opacity-50">{busy ? t("saving") : t("save")}</button><span role="status" className="text-sm text-text-muted">{message}</span></div>
  </section>
}
