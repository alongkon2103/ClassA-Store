"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslations, useLocale } from "next-intl"

type PluginMeta = { version: string; sha256: string; size: number; uploaded_at: string } | null

export default function AdminPluginPage() {
  const t = useTranslations("Admin")
  const locale = useLocale()
  const [meta, setMeta] = useState<PluginMeta>(null)
  const [loading, setLoading] = useState(true)
  const [version, setVersion] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch("/api/admin/desktop/plugin")
    setMeta(res.ok ? (await res.json()).plugin : null)
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const fmtSize = (n: number) => (n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1024 / 1024).toFixed(2)} MB`)
  const fmtDate = (iso: string) => new Date(iso).toLocaleString(locale === "th" ? "th-TH" : "en-GB", { dateStyle: "medium", timeStyle: "short" })

  const upload = async () => {
    if (!file || !version.trim()) { setMsg({ text: t("plugin_need_both"), bad: true }); return }
    setBusy(true); setMsg(null)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("version", version.trim())
      const res = await fetch("/api/admin/desktop/plugin", { method: "POST", body: fd })
      if (res.ok) {
        setMsg({ text: t("plugin_upload_ok") })
        setFile(null); setVersion("")
        if (fileRef.current) fileRef.current.value = ""
        await load()
      } else {
        setMsg({ text: (await res.json().catch(() => ({}))).error || t("plugin_upload_fail"), bad: true })
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-[24px] font-bold">{t("plugin_manage")}</h1>
        <p className="text-text-muted text-[13px] mt-0.5">{t("plugin_sub")}</p>
      </div>

      {/* Current */}
      <section className="bg-bg-card border border-accent/10 rounded-2xl p-5">
        <p className="text-[11px] tracking-widest text-text-muted uppercase mb-3">{t("plugin_current")}</p>
        {loading ? (
          <p className="text-text-muted text-[13px]">{t("loading")}</p>
        ) : !meta ? (
          <p className="text-amber-400/90 text-[13px]">{t("plugin_none")}</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 text-[13px]">
            <div><p className="text-[11px] text-text-muted uppercase">{t("plugin_version")}</p><p className="font-bold">{meta.version}</p></div>
            <div><p className="text-[11px] text-text-muted uppercase">{t("plugin_size")}</p><p className="font-mono">{fmtSize(meta.size)}</p></div>
            <div className="col-span-2"><p className="text-[11px] text-text-muted uppercase">SHA-256</p><p className="font-mono text-[11px] break-all text-text-muted">{meta.sha256}</p></div>
            <div className="col-span-2"><p className="text-[11px] text-text-muted uppercase">{t("plugin_uploaded")}</p><p>{fmtDate(meta.uploaded_at)}</p></div>
          </div>
        )}
      </section>

      {/* Upload */}
      <section className="bg-bg-card border border-accent/10 rounded-2xl p-5">
        <p className="text-[11px] tracking-widest text-text-muted uppercase mb-1">{t("plugin_upload")}</p>
        <p className="text-[11px] text-text-muted mb-4">{t("plugin_upload_hint")}</p>

        <label className="block text-[12px] text-text-muted mb-1.5">{t("plugin_version")}</label>
        <input
          value={version}
          onChange={(e) => setVersion(e.target.value)}
          placeholder="1.3.0"
          className="w-full bg-bg-base border border-accent/15 rounded-xl px-4 py-2.5 text-[13px] mb-4 outline-none focus:border-accent/40"
        />

        <label className="block text-[12px] text-text-muted mb-1.5">{t("plugin_file")}</label>
        <input
          ref={fileRef}
          type="file"
          accept=".jar,application/java-archive,application/zip"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="w-full text-[13px] text-text-muted file:mr-3 file:px-4 file:py-2 file:rounded-lg file:border-0 file:bg-accent/15 file:text-accent-light file:text-[12px] file:cursor-pointer mb-4"
        />

        <div className="flex items-center gap-3">
          <button
            onClick={upload}
            disabled={busy || !file || !version.trim()}
            className="px-5 py-2.5 rounded-xl bg-accent text-white text-[13px] font-semibold hover:bg-accent/90 transition disabled:opacity-50"
          >
            {busy ? t("plugin_uploading") : t("plugin_upload_btn")}
          </button>
          {msg && <span className={`text-[12px] ${msg.bad ? "text-red-400" : "text-green-400"}`}>{msg.text}</span>}
        </div>
      </section>
    </div>
  )
}
