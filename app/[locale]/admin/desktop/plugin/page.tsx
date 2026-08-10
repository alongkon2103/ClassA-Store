"use client"

import { useCallback, useEffect, useState } from "react"
import { useTranslations, useLocale } from "next-intl"

type PluginMeta = { version: string; sha256: string; size: number; uploaded_at: string } | null
type Program = { id: string; program_key: string; name_en: string; name_th: string; plugin: PluginMeta }

export default function AdminPluginPage() {
  const t = useTranslations("Admin")
  const locale = useLocale()
  const [programs, setPrograms] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch("/api/admin/desktop/plugin")
    setPrograms(res.ok ? (await res.json()).programs : [])
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const fmtSize = (n: number) => (n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1024 / 1024).toFixed(2)} MB`)
  const fmtDate = (iso: string) => new Date(iso).toLocaleString(locale === "th" ? "th-TH" : "en-GB", { dateStyle: "medium", timeStyle: "short" })

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-[24px] font-bold">{t("plugin_manage")}</h1>
        <p className="text-text-muted text-[13px] mt-0.5">{t("plugin_sub")}</p>
      </div>

      {loading ? (
        <p className="text-text-muted text-[13px]">{t("loading")}</p>
      ) : programs.length === 0 ? (
        <p className="text-amber-400/90 text-[13px]">{t("plugin_no_programs")}</p>
      ) : (
        programs.map((p) => (
          <ProgramCard key={p.id} program={p} onSaved={load} t={t} fmtSize={fmtSize} fmtDate={fmtDate} locale={locale} />
        ))
      )}
    </div>
  )
}

function ProgramCard({ program, onSaved, t, fmtSize, fmtDate, locale }: {
  program: Program
  onSaved: () => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: any
  fmtSize: (n: number) => string
  fmtDate: (iso: string) => string
  locale: string
}) {
  const [version, setVersion] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null)
  const meta = program.plugin

  const upload = async () => {
    if (!file || !version.trim()) { setMsg({ text: t("plugin_need_both"), bad: true }); return }
    setBusy(true); setMsg(null)
    try {
      const fd = new FormData()
      fd.append("program", program.program_key)
      fd.append("file", file)
      fd.append("version", version.trim())
      const res = await fetch("/api/admin/desktop/plugin", { method: "POST", body: fd })
      if (res.ok) { setMsg({ text: t("plugin_upload_ok") }); setFile(null); setVersion(""); onSaved() }
      else setMsg({ text: (await res.json().catch(() => ({}))).error || t("plugin_upload_fail"), bad: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="bg-bg-card border border-accent/10 rounded-2xl p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <p className="text-[15px] font-bold">{locale === "th" ? program.name_th : program.name_en}</p>
          <p className="text-[11px] text-text-muted font-mono">{program.program_key}</p>
        </div>
        {meta ? (
          <span className="text-[11px] px-2.5 py-1 rounded-full bg-green-500/15 text-green-400 font-medium">v{meta.version}</span>
        ) : (
          <span className="text-[11px] px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-400 font-medium">{t("plugin_none_short")}</span>
        )}
      </div>

      {meta && (
        <div className="grid grid-cols-2 gap-3 text-[12px] bg-white/[0.02] border border-white/5 rounded-xl p-3 mb-4">
          <div><span className="text-text-muted">{t("plugin_size")}: </span><span className="font-mono">{fmtSize(meta.size)}</span></div>
          <div><span className="text-text-muted">{t("plugin_uploaded")}: </span>{fmtDate(meta.uploaded_at)}</div>
          <div className="col-span-2"><span className="text-text-muted">SHA-256: </span><span className="font-mono text-[10px] break-all">{meta.sha256}</span></div>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <div className="w-28">
          <label className="block text-[11px] text-text-muted mb-1">{t("plugin_version")}</label>
          <input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="1.3.0"
            className="w-full bg-bg-base border border-accent/15 rounded-lg px-3 py-2 text-[13px] outline-none focus:border-accent/40" />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[11px] text-text-muted mb-1">{t("plugin_file")}</label>
          <input type="file" accept=".jar,application/java-archive,application/zip"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full text-[12px] text-text-muted file:mr-2 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-accent/15 file:text-accent-light file:text-[12px] file:cursor-pointer" />
        </div>
        <button onClick={upload} disabled={busy || !file || !version.trim()}
          className="px-5 py-2 rounded-xl bg-accent text-white text-[13px] font-semibold hover:bg-accent/90 transition disabled:opacity-50">
          {busy ? t("plugin_uploading") : t("plugin_upload_btn")}
        </button>
      </div>
      {msg && <p className={`text-[12px] mt-2 ${msg.bad ? "text-red-400" : "text-green-400"}`}>{msg.text}</p>}
    </section>
  )
}
