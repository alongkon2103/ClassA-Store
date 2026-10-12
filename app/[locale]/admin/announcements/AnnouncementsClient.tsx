"use client"

import { useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Megaphone, Plus, Pencil, Trash2, ImagePlus, Eye } from "lucide-react"
import TiptapEditor from "@/components/admin/TiptapEditor"
import AnnouncementDialog from "@/components/announcements/AnnouncementDialog"
import { getImageUrl } from "@/lib/getImageUrl"
import { localeTag } from "@/lib/i18n/locale"
import { announcementStatus, fromBangkokInput, toBangkokInput, type WebAnnouncement, type WebAnnouncementInput } from "@/lib/webAnnouncements"
import { parseWebAnnouncement } from "@/lib/webAnnouncementValidation"

type Form = { title: string; content: string; imageUrl: string; startsAt: string; endsAt: string; enabled: boolean }
const input = "w-full rounded-lg border border-border-soft bg-bg-input px-3 py-2.5 text-sm text-text-base outline-none focus:border-accent"
const button = "inline-flex items-center justify-center gap-2 rounded-lg border border-border-soft px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed"
const secondaryButton = `${button} enabled:hover:bg-bg-base disabled:opacity-50`
const primaryButton = `${button} bg-accent text-on-accent enabled:hover:brightness-95`
const blank = (): Form => ({ title: "", content: "", imageUrl: "", startsAt: toBangkokInput(new Date().toISOString()), endsAt: "", enabled: false })
const statusStyle = { draft: "bg-bg-base text-text-muted", scheduled: "bg-accent/10 text-accent-light", active: "bg-success/10 text-success", expired: "bg-bg-base text-text-dim" }

export default function AnnouncementsClient({ initialItems, initialError = false }: { initialItems: WebAnnouncement[]; initialError?: boolean }) {
  const t = useTranslations("WebAnnouncements")
  const locale = useLocale()
  const [items, setItems] = useState(initialItems)
  const [form, setForm] = useState<Form | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState(initialError ? "load_failed" : "")
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<WebAnnouncementInput | null>(null)
  const formatter = new Intl.DateTimeFormat(localeTag(locale), { dateStyle: "medium", timeStyle: "medium", timeZone: "Asia/Bangkok" })

  const edit = (item?: WebAnnouncement) => {
    setEditingId(item?.id ?? null)
    setError("")
    setForm(item ? { title: item.title, content: item.content, imageUrl: item.imageUrl ?? "", startsAt: toBangkokInput(item.startsAt), endsAt: item.endsAt ? toBangkokInput(item.endsAt) : "", enabled: item.enabled } : blank())
  }
  const change = (patch: Partial<Form>) => setForm((current) => current ? { ...current, ...patch } : current)
  const parseForm = () => {
    if (!form) return null
    const startsAt = fromBangkokInput(form.startsAt)
    const endsAt = form.endsAt ? fromBangkokInput(form.endsAt) : null
    if (!startsAt || (form.endsAt && !endsAt)) { setError("invalid_dates"); return null }
    const result = parseWebAnnouncement({ ...form, startsAt, endsAt })
    if ("error" in result) { setError(result.error); return null }
    setError("")
    return result.data
  }
  const upload = async (file: File): Promise<string> => {
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error("invalid_upload")
    const body = new FormData()
    body.append("file", file)
    const r = await fetch("/api/admin/upload", { method: "POST", body })
    const data = await r.json()
    if (!r.ok || !data.url) throw new Error("upload_failed")
    return data.url
  }
  const coverUpload = async (file?: File) => {
    if (!file) return
    setUploading(true); setError("")
    try { change({ imageUrl: await upload(file) }) }
    catch (e) { setError(e instanceof Error ? e.message : "upload_failed") }
    finally { setUploading(false) }
  }
  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    const data = parseForm()
    if (!data || busy || uploading) return
    setBusy(true)
    try {
      const r = await fetch(editingId ? `/api/admin/web-announcements/${editingId}` : "/api/admin/web-announcements", { method: editingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
      const result = await r.json()
      if (!r.ok) { setError(result.error || "save_failed"); return }
      const item = result as WebAnnouncement
      setItems((current) => [item, ...current.filter((a) => a.id !== item.id)].sort((a, b) => b.startsAt.localeCompare(a.startsAt)))
      setForm(null)
    } catch { setError("save_failed") }
    finally { setBusy(false) }
  }
  const remove = async (item: WebAnnouncement) => {
    if (!confirm(t("delete_confirm", { title: item.title }))) return
    setBusy(true); setError("")
    try {
      const r = await fetch(`/api/admin/web-announcements/${item.id}`, { method: "DELETE" })
      if (!r.ok) { setError("delete_failed"); return }
      setItems((current) => current.filter((a) => a.id !== item.id))
      if (editingId === item.id) setForm(null)
    } catch { setError("delete_failed") }
    finally { setBusy(false) }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><Megaphone className="text-accent-light" size={24} />{t("admin_title")}</h1>
          <p className="mt-2 max-w-2xl text-sm text-text-muted">{t("admin_description")}</p>
        </div>
        <button type="button" onClick={() => edit()} disabled={busy || uploading || !!form} className={primaryButton}><Plus size={17} />{t("create")}</button>
      </header>
      {error && <div role="alert" className="rounded-lg border border-hot/30 bg-hot/5 p-3 text-sm text-hot">{t.has(`errors.${error}`) ? t(`errors.${error}`) : t("errors.save_failed")}</div>}

      {form && (
        <form onSubmit={save} className="rounded-xl border border-border-soft bg-bg-card p-4 sm:p-6">
          <h2 className="mb-5 text-lg font-bold">{editingId ? t("edit") : t("create")}</h2>
          <fieldset disabled={busy || uploading} className="grid min-w-0 gap-6 disabled:opacity-70 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0 space-y-5">
              <label className="block text-sm font-semibold">{t("title")}<input required maxLength={200} value={form.title} onChange={(e) => change({ title: e.target.value })} className={`${input} mt-2`} /></label>
              <div>
                <p className="mb-2 text-sm font-semibold">{t("content")}</p>
                <p className="mb-3 text-xs text-text-dim">{t("content_hint")}</p>
                <div inert={busy}><TiptapEditor content={form.content} onChange={(content) => change({ content })} onImageUpload={async (file) => {
                  setUploading(true); setError("")
                  try { return getImageUrl(await upload(file)) }
                  catch (e) { setError(e instanceof Error ? e.message : "upload_failed"); throw e }
                  finally { setUploading(false) }
                }} uploadImageLabel={t("upload_inline")} /></div>
              </div>
            </div>
            <aside className="min-w-0 space-y-5">
              <div>
                <p className="mb-2 text-sm font-semibold">{t("cover")}</p>
                {form.imageUrl && <img src={getImageUrl(form.imageUrl)} alt="" className="mb-3 max-h-48 w-full rounded-lg border border-border-soft object-contain" />}
                <label className={`${button} hover:bg-bg-base w-full cursor-pointer`}><ImagePlus size={16} />{uploading ? t("uploading") : t("upload_cover")}<input aria-label={t("upload_cover")} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={(e) => { void coverUpload(e.target.files?.[0]); e.target.value = "" }} /></label>
                {form.imageUrl && <button type="button" onClick={() => change({ imageUrl: "" })} className="mt-2 text-xs font-semibold text-hot">{t("remove_cover")}</button>}
                <p className="mt-2 text-xs text-text-dim">{t("upload_hint")}</p>
              </div>
              <div className="space-y-4 rounded-xl border border-border-soft bg-bg-base p-4">
                <h3 className="text-sm font-bold">{t("schedule")}</h3>
                <p className="text-xs text-text-dim">{t("timezone")}</p>
                <label className="block text-sm font-semibold">{t("starts_at")}<input required type="datetime-local" step={1} value={form.startsAt} onInput={(e) => change({ startsAt: e.currentTarget.value })} onChange={(e) => change({ startsAt: e.target.value })} className={`${input} mt-2`} /></label>
                <label className="block text-sm font-semibold">{t("ends_at")}<input type="datetime-local" step={1} value={form.endsAt} onInput={(e) => change({ endsAt: e.currentTarget.value })} onChange={(e) => change({ endsAt: e.target.value })} className={`${input} mt-2`} /></label>
                <p className="text-xs text-text-dim">{t("end_hint")}</p>
                <label className="flex items-start gap-2 text-sm font-semibold"><input type="checkbox" checked={form.enabled} onChange={(e) => change({ enabled: e.target.checked })} className="mt-1 accent-accent" />{t("enabled")}</label>
              </div>
              <p className="text-xs leading-relaxed text-text-dim">{t("dismiss_hint")}</p>
            </aside>
          </fieldset>
          <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-border-soft pt-4">
            <button type="button" disabled={busy || uploading} onClick={() => { const data = parseForm(); if (data) setPreview(data) }} className={secondaryButton}><Eye size={16} />{t("preview")}</button>
            <button type="button" disabled={busy || uploading} onClick={() => { setForm(null); setError("") }} className={secondaryButton}>{t("cancel")}</button>
            <button type="submit" disabled={busy || uploading} aria-busy={busy} className={primaryButton}>{busy ? t("saving") : t("save")}</button>
          </div>
        </form>
      )}

      {items.length === 0 ? <div className="rounded-xl border border-dashed border-border-soft bg-bg-card px-6 py-14 text-center text-sm text-text-muted">{t("empty")}</div> : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {items.map((item) => {
            const status = announcementStatus(item)
            return <article key={item.id} className="overflow-hidden rounded-xl border border-border-soft bg-bg-card">
              {item.imageUrl && <img src={getImageUrl(item.imageUrl)} alt="" className="h-36 w-full bg-bg-base object-contain" />}
              <div className="p-5">
                <span className={`inline-block rounded-md px-2 py-1 text-xs font-semibold ${statusStyle[status]}`}>{t(`status.${status}`)}</span>
                <h2 className="mt-3 break-words text-lg font-bold">{item.title}</h2>
                <dl className="mt-3 space-y-2 text-xs text-text-muted">
                  <div><dt className="font-semibold">{t("starts_at")}</dt><dd>{formatter.format(new Date(item.startsAt))}</dd></div>
                  <div><dt className="font-semibold">{t("ends_at")}</dt><dd>{item.endsAt ? formatter.format(new Date(item.endsAt)) : t("no_end")}</dd></div>
                  <div><dt className="font-semibold">{t("updated_at")}</dt><dd>{formatter.format(new Date(item.updatedAt))}</dd></div>
                </dl>
                <div className="mt-4 flex flex-wrap gap-2 border-t border-border-soft pt-4">
                  <button type="button" onClick={() => setPreview(item)} className={secondaryButton}><Eye size={15} />{t("preview")}</button>
                  <button type="button" disabled={busy || uploading || !!form} onClick={() => edit(item)} className={secondaryButton}><Pencil size={15} />{t("edit")}</button>
                  <button type="button" disabled={busy || uploading} onClick={() => void remove(item)} aria-label={t("delete")} className={`${secondaryButton} text-hot`}><Trash2 size={15} /></button>
                </div>
              </div>
            </article>
          })}
        </div>
      )}
      {preview && <AnnouncementDialog announcement={preview} onClose={() => setPreview(null)} />}
    </div>
  )
}
