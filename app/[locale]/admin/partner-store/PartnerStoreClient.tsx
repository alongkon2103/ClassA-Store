"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations, useLocale } from "next-intl"

type PartnerProduct = {
  id: string
  external_slug: string
  name_th: string
  name_en: string
  badge: string | null
  thumbnail_url: string | null
  ref_url: string
  price_from_thb: number | null
  plans_count: number
  is_visible: boolean
  sort_order: number
}
type Store = {
  id: string
  key: string
  display_name: string
  site_url: string | null
  ref_slug: string | null
  commission_pct: number | null
  is_active: boolean
  last_synced_at: string | null
  last_sync_error: string | null
  products: PartnerProduct[]
}
type Configured = { key: string; display_name: string; envKey: string }

export default function PartnerStoreClient({ stores, configured }: { stores: Store[]; configured: Configured[] }) {
  const t = useTranslations("Admin")
  const locale = useLocale()
  const router = useRouter()
  const [syncing, setSyncing] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const syncedKeys = new Set(stores.map((s) => s.key))
  const notSynced = configured.filter((c) => !syncedKeys.has(c.key))

  const runSync = async (key?: string) => {
    setSyncing(key ?? "all")
    setMsg(null)
    try {
      const r = await fetch("/api/admin/partner-store/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(key ? { key } : {}),
      })
      const data = await r.json().catch(() => null)
      if (!r.ok) {
        const err = data?.result ? JSON.stringify(data.result) : `HTTP ${r.status}`
        setMsg(`❌ ${t("sync_error")}: ${err}`)
      } else {
        setMsg(`✅ ${t("sync_done")}`)
        router.refresh()
      }
    } catch (e) {
      setMsg(`❌ ${e instanceof Error ? e.message : "sync failed"}`)
    } finally {
      setSyncing(null)
    }
  }

  const toggleVisible = async (p: PartnerProduct) => {
    setBusy(p.id)
    try {
      const r = await fetch(`/api/admin/partner-store/products/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_visible: !p.is_visible }),
      })
      if (r.ok) router.refresh()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="p-5 sm:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-text-base">{t("partner_store")}</h1>
        <p className="text-[13px] text-text-muted mt-1">{t("partner_store_desc")}</p>
      </div>

      {msg && <div className="text-[13px] px-4 py-2 rounded-lg bg-bg-card border border-accent/10">{msg}</div>}

      {/* Configured-but-not-synced partners */}
      {notSynced.map((c) => (
        <div key={c.key} className="bg-bg-card border border-yellow-500/20 rounded-2xl p-5 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[14px] font-semibold text-text-base">{c.display_name}</p>
            <p className="text-[12px] text-text-muted mt-0.5">{t("set_env_hint")} <code className="text-accent-light">{c.envKey}</code></p>
          </div>
          <button onClick={() => runSync(c.key)} disabled={syncing !== null}
            className="px-4 py-2 rounded-lg bg-accent text-white text-[13px] font-semibold hover:opacity-90 disabled:opacity-50">
            {syncing === c.key ? t("syncing") : t("sync_now")}
          </button>
        </div>
      ))}

      {stores.map((store) => (
        <div key={store.id} className="bg-bg-card border border-accent/10 rounded-2xl overflow-hidden">
          <div className="p-5 flex items-start justify-between gap-4 flex-wrap border-b border-white/5">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase bg-violet-500 text-white px-2 py-0.5 rounded-full">Partner</span>
                <p className="text-[15px] font-bold text-text-base">{store.display_name}</p>
              </div>
              <p className="text-[12px] text-text-muted mt-1">
                ref: <span className="text-accent-light">{store.ref_slug ?? "—"}</span> · {t("commission")}: {store.commission_pct ?? "—"}%
                {" · "}
                {store.last_synced_at
                  ? `${t("last_synced")}: ${new Date(store.last_synced_at).toLocaleString(locale === "th" ? "th-TH" : "en-US")}`
                  : t("never_synced")}
              </p>
              {store.last_sync_error && (
                <p className="text-[12px] text-red-400 mt-1">⚠ {t("sync_error")}: {store.last_sync_error}</p>
              )}
            </div>
            <button onClick={() => runSync(store.key)} disabled={syncing !== null}
              className="px-4 py-2 rounded-lg bg-accent text-white text-[13px] font-semibold hover:opacity-90 disabled:opacity-50">
              {syncing === store.key ? t("syncing") : t("sync_now")}
            </button>
          </div>

          {store.products.length === 0 ? (
            <p className="p-5 text-[13px] text-text-muted">{t("no_partner_products")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px] min-w-[560px]">
                <thead>
                  <tr className="text-left text-[11px] text-text-muted border-b border-white/5">
                    <th className="px-5 py-3 font-medium">{t("product")}</th>
                    <th className="px-3 py-3 font-medium">{t("price")}</th>
                    <th className="px-3 py-3 font-medium">{t("plans")}</th>
                    <th className="px-3 py-3 font-medium text-center">{t("visible")}</th>
                    <th className="px-5 py-3 font-medium text-right">{t("buy_link")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {store.products.map((p) => (
                    <tr key={p.id} className={`hover:bg-white/[0.02] ${p.is_visible ? "" : "opacity-50"}`}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          {p.thumbnail_url ? (
                            <img src={p.thumbnail_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-accent/20 flex-shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="text-text-base font-medium line-clamp-1">{locale === "th" ? p.name_th : p.name_en}</p>
                            <p className="text-[11px] text-text-muted">{p.external_slug}{p.badge ? ` · ${p.badge}` : ""}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-accent-light font-semibold">
                        {p.price_from_thb != null ? `฿${p.price_from_thb.toLocaleString()}` : "—"}
                      </td>
                      <td className="px-3 py-3 text-text-muted">{p.plans_count}</td>
                      <td className="px-3 py-3 text-center">
                        <button
                          onClick={() => toggleVisible(p)}
                          disabled={busy === p.id}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${p.is_visible ? "bg-green-500" : "bg-white/15"} disabled:opacity-50`}
                          title={p.is_visible ? t("visible") : t("hidden")}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${p.is_visible ? "translate-x-4" : "translate-x-0.5"}`} />
                        </button>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <a href={p.ref_url} target="_blank" rel="noopener noreferrer" className="text-[12px] text-accent-light hover:underline">
                          {t("open")} ↗
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
