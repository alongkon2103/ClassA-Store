"use client"

import { useEffect, useId, useRef, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import Image from "next/image"
import { ArrowDown, ArrowUp, Check, ImagePlus, Images, Loader2, Pencil, Plus, RotateCcw, Trash2, X } from "lucide-react"
import type { gifts as Gift } from "@prisma/client"
import { getImageUrl } from "@/lib/getImageUrl"
import FunctionGiftPicker, { GiftDetails } from "./FunctionGiftPicker"
import { BULK_LIMIT, IMAGE_ACCEPT, LIKE_THRESHOLDS, categoryOf, functionPayload, inferFunction, moveWithinCategory, validateFunction, validateImage, type FunctionCategory, type FunctionDraft, type FunctionSection } from "./function-manager-model"

type Translate = ReturnType<typeof useTranslations<"AdminFunctions">>
type ProductFunction = { id: string; product_id: string; name: string; label_th: string | null; label_en: string | null; image_url: string | null; category?: string | null; sort_order: number; default_gift_id: number | null; default_trigger_threshold: number | null; created_at: string | null }
type Props = { productId: string; functions: ProductFunction[]; allGifts: Gift[] }
type Staged = FunctionDraft & { id: string; file: File; preview: string; progress: number; state: "ready" | "uploading" | "uploaded" | "error"; error?: string }
const inputClass = "w-full min-w-0 rounded-lg border border-accent/15 bg-bg-base px-3 py-2 text-[13px] outline-none transition focus:border-accent disabled:opacity-50"
const buttonClass = "inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-accent/15 px-3 py-2 text-[12px] font-medium transition hover:bg-accent/10 focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40"
const primaryClass = `${buttonClass} border-transparent bg-accent text-white hover:opacity-90`
const categories: FunctionCategory[] = ["help", "troll", "neutral"]
const blank = (category: FunctionCategory = "neutral"): FunctionDraft => ({ name: "", label_th: "", label_en: "", image_url: "", category, default_gift_id: null, default_trigger_threshold: "" })

export default function FunctionManager({ productId, functions: initial, allGifts }: Props) {
  const t = useTranslations("AdminFunctions"), locale = useLocale(), prefix = useId()
  const [functions, setFunctions] = useState(() => [...initial].sort((a, b) => a.sort_order - b.sort_order))
  const [form, setForm] = useState<FunctionDraft>(blank()), [editor, setEditor] = useState<"new" | string | null>(null)
  const [busy, setBusy] = useState(false), [uploading, setUploading] = useState(false)
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null)
  const [bulkCategory, setBulkCategory] = useState<FunctionCategory | null>(null), [staged, setStaged] = useState<Staged[]>([]), [bulkBusy, setBulkBusy] = useState(false)
  const uploads = useRef(new Set<XMLHttpRequest>()), previews = useRef(new Set<string>()), mounted = useRef(true), stageSerial = useRef(0)
  const locked = busy || uploading || bulkBusy
  useEffect(() => {
    mounted.current = true
    const requests = uploads.current, urls = previews.current
    return () => { mounted.current = false; requests.forEach(request => request.abort()); urls.forEach(url => URL.revokeObjectURL(url)) }
  }, [])
  const report = (text: string, error = true) => setNotice({ text, error })
  const giftFor = (id: number | null) => allGifts.find(gift => gift.id === id) || null
  const errorText = (data: { error?: string; field?: string }) => data.error === "gift_not_found" ? t("giftMissing") : data.field ? t("fieldError", { field: data.field }) : t("error")
  const upload = (file: File, progress: (value: number) => void): Promise<string> => new Promise((resolve, reject) => {
    const request = new XMLHttpRequest(), body = new FormData()
    body.append("file", file); body.append("type", "image")
    uploads.current.add(request); request.open("POST", "/api/admin/upload"); request.responseType = "json"; request.timeout = 60000
    request.upload.onprogress = event => { if (event.lengthComputable && mounted.current) progress(Math.round(event.loaded / event.total * 100)) }
    request.onload = () => { uploads.current.delete(request); if (request.status >= 200 && request.status < 300 && typeof request.response?.url === "string") resolve(request.response.url); else reject(new Error(t("uploadFailed"))) }
    request.onerror = request.onabort = request.ontimeout = () => { uploads.current.delete(request); reject(new Error(t("uploadFailed"))) }
    request.send(body)
  })
  const openAdd = (category: FunctionCategory) => { setForm(blank(category)); setEditor("new"); setNotice(null) }
  const openEdit = (item: ProductFunction) => {
    setForm({ name: item.name, label_th: item.label_th || "", label_en: item.label_en || "", image_url: item.image_url || "", category: categoryOf(item) === "unclassified" ? "" : item.category as FunctionCategory, default_gift_id: item.default_gift_id, default_trigger_threshold: item.default_trigger_threshold?.toString() || "" }); setEditor(item.id); setNotice(null)
  }
  const save = async () => {
    const invalid = validateFunction(form, allGifts)
    if (invalid) { report(t(invalid)); return }
    setBusy(true); setNotice(null)
    try {
      const adding = editor === "new"
      const response = await fetch(`/api/admin/products/${productId}/functions${adding ? "" : `/${editor}`}`, { method: adding ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...functionPayload(form), ...(adding ? { sort_order: Math.max(-1, ...functions.map(item => item.sort_order)) + 1 } : {}) }) })
      const data = await response.json()
      if (!response.ok) { report(errorText(data)); return }
      setFunctions(current => (adding ? [...current, data] : current.map(item => item.id === editor ? data : item)).sort((a, b) => a.sort_order - b.sort_order)); setEditor(null); report(t("saved"), false)
    } catch { report(t("error")) } finally { setBusy(false) }
  }
  const remove = async (item: ProductFunction) => {
    if (!window.confirm(t("deleteConfirm"))) return
    setBusy(true)
    try { const response = await fetch(`/api/admin/products/${productId}/functions/${item.id}`, { method: "DELETE" }); if (!response.ok) { report(t("error")); return }; setFunctions(current => current.filter(row => row.id !== item.id)); report(t("deleted"), false) } catch { report(t("error")) } finally { setBusy(false) }
  }
  const move = async (id: string, direction: -1 | 1) => {
    const previous = functions, next = moveWithinCategory(functions, id, direction)
    if (next === previous) return
    setBusy(true); setFunctions(next)
    try { const response = await fetch(`/api/admin/products/${productId}/functions/reorder`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next.map(({ id, sort_order }) => ({ id, sort_order }))) }); if (!response.ok) throw new Error(); report(t("saved"), false) } catch { setFunctions(previous); report(t("reorderFailed")) } finally { setBusy(false) }
  }
  const uploadSingle = async (file: File) => {
    const invalid = validateImage(file); if (invalid) { report(t(invalid)); return }
    setUploading(true)
    try { const url = await upload(file, () => {}); if (mounted.current) setForm(current => ({ ...current, image_url: url })) } catch { if (mounted.current) report(t("uploadFailed")) } finally { if (mounted.current) setUploading(false) }
  }
  const clearStaging = () => { staged.forEach(row => { URL.revokeObjectURL(row.preview); previews.current.delete(row.preview) }); setStaged([]); setBulkCategory(null) }
  const openBulk = (category: FunctionCategory) => { setBulkCategory(category); setEditor(null); setNotice(null) }
  const stageFiles = (files: FileList | null) => {
    if (!files) return
    if (staged.length + files.length > BULK_LIMIT) { report(t("bulkLimit", { count: BULK_LIMIT })); return }
    const rows = Array.from(files).map(file => { const preview = URL.createObjectURL(file); previews.current.add(preview); const invalid = validateImage(file); return { ...blank(bulkCategory || "neutral"), ...inferFunction(file.name), id: `staged-${++stageSerial.current}`, file, preview, progress: 0, state: invalid ? "error" : "ready", error: invalid ? t(invalid) : undefined } as Staged })
    setStaged(current => [...current, ...rows])
  }
  const stage = (id: string, patch: Partial<Staged>) => setStaged(current => current.map(row => row.id === id ? { ...row, ...patch } : row))
  const submitBulk = async () => {
    if (!staged.length || locked) return
    let invalid = false
    for (const row of staged) {
      const problem = validateImage(row.file) || validateFunction(row, allGifts)
      stage(row.id, { error: problem ? t(problem) : undefined }); if (problem) invalid = true
    }
    if (invalid) { report(t("bulkCheck")); return }
    setBulkBusy(true); setNotice(null)
    const working = staged.map(row => ({ ...row })); let failed = false
    try {
      for (const row of working) {
        if (!mounted.current) return
        if (row.image_url) continue
        stage(row.id, { state: "uploading", progress: 0, error: undefined })
        try { row.image_url = await upload(row.file, progress => stage(row.id, { progress })); if (!mounted.current) return; stage(row.id, { image_url: row.image_url, state: "uploaded", progress: 100 }) }
        catch { failed = true; if (mounted.current) stage(row.id, { state: "error", error: t("uploadFailed") }) }
      }
      if (!mounted.current) return
      if (failed) { report(t("bulkUploadFailed")); return }
      const response = await fetch(`/api/admin/products/${productId}/functions/bulk`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: working.map(functionPayload) }) })
      const data = await response.json()
      if (!response.ok) { if (Number.isInteger(data.index) && working[data.index]) stage(working[data.index].id, { error: errorText(data) }); report(errorText(data)); return }
      setFunctions(current => [...current, ...data.functions].sort((a, b) => a.sort_order - b.sort_order)); clearStaging(); report(t("bulkSaved", { count: data.functions.length }), false)
    } catch { if (mounted.current) report(t("error")) } finally { if (mounted.current) setBulkBusy(false) }
  }
  const section = (category: FunctionSection) => {
    const rows = functions.filter(item => categoryOf(item) === category)
    if ((category === "neutral" || category === "unclassified") && !rows.length) return null
    return <section key={category} className="min-w-0 rounded-xl border border-accent/15 bg-bg-card" aria-labelledby={`${prefix}-${category}`}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-accent/10 p-4">
        <div><h3 id={`${prefix}-${category}`} className="text-[15px] font-semibold">{t(category)} <span className="ml-1 text-[12px] font-normal text-text-muted">{rows.length}</span></h3>{category === "unclassified" && <p className="mt-1 text-[12px] text-text-muted">{t("unclassifiedHint")}</p>}</div>
        <div className="flex gap-1"><button type="button" disabled={locked} className={buttonClass} onClick={() => openAdd(category === "unclassified" ? "neutral" : category)}><Plus size={14} aria-hidden="true" />{t("addFunction")}</button><button type="button" disabled={locked} className={buttonClass} aria-label={t("bulkIn", { category: t(category) })} title={t("bulkAdd")} onClick={() => openBulk(category === "unclassified" ? "neutral" : category)}><Images size={15} aria-hidden="true" /></button></div>
      </header>
      {!rows.length && <p className="p-6 text-center text-[12px] text-text-muted">{t("sectionEmpty")}</p>}
      <div className="divide-y divide-accent/10">{rows.map((item, index) => {
        const gift = giftFor(item.default_gift_id), label = (locale === "th" ? item.label_th : item.label_en) || item.label_th || item.label_en || item.name
        return <article key={item.id} data-function-id={item.id} className="flex min-w-0 items-center gap-3 p-3">
          <div className="flex shrink-0 flex-col"><button type="button" className="rounded p-1 text-text-muted hover:text-accent-light disabled:opacity-25" disabled={locked || index === 0} aria-label={t("moveUp", { name: label })} onClick={() => move(item.id, -1)}><ArrowUp size={14} aria-hidden="true" /></button><button type="button" className="rounded p-1 text-text-muted hover:text-accent-light disabled:opacity-25" disabled={locked || index === rows.length - 1} aria-label={t("moveDown", { name: label })} onClick={() => move(item.id, 1)}><ArrowDown size={14} aria-hidden="true" /></button></div>
          {item.image_url ? <Image src={getImageUrl(item.image_url)} width={40} height={40} alt="" className="h-10 w-10 shrink-0 rounded-lg object-contain" unoptimized /> : <ImagePlus className="h-8 w-8 shrink-0 text-text-muted" aria-hidden="true" />}
          <div className="min-w-0 flex-1"><p className="truncate text-[13px] font-medium">{label}</p><p className="truncate text-[11px] text-text-muted">{item.name}</p>{item.default_gift_id !== null && <div className="mt-2"><GiftDetails gift={gift} unavailable={t("giftUnavailable", { id: item.default_gift_id })} />{item.default_trigger_threshold !== null && <p className="mt-0.5 text-[11px] text-text-muted">{t("thresholdValue", { count: item.default_trigger_threshold })}</p>}</div>}</div>
          <div className="flex shrink-0 gap-1"><button type="button" disabled={locked} className={`${buttonClass} px-2`} aria-label={t("editNamed", { name: label })} onClick={() => openEdit(item)}><Pencil size={14} aria-hidden="true" /></button><button type="button" disabled={locked} className={`${buttonClass} px-2 text-text-muted hover:text-red-400`} aria-label={t("deleteNamed", { name: label })} onClick={() => remove(item)}><Trash2 size={14} aria-hidden="true" /></button></div>
        </article>
      })}</div>
    </section>
  }
  return <div className="space-y-5" data-function-manager>
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-[18px] font-semibold">{t("title")}</h2><p className="mt-1 text-[13px] text-text-muted">{t("subtitle")}</p></div><div className="flex gap-2"><button type="button" disabled={locked} className={buttonClass} onClick={() => openBulk("neutral")}><Images size={15} aria-hidden="true" />{t("bulkAdd")}</button><button type="button" disabled={locked} className={primaryClass} onClick={() => openAdd("neutral")}><Plus size={15} aria-hidden="true" />{t("addFunction")}</button></div></header>
    {notice && <p role={notice.error ? "alert" : "status"} className={`rounded-lg border px-4 py-3 text-[13px] ${notice.error ? "border-red-400/25 bg-red-500/5 text-red-400" : "border-emerald-400/25 bg-emerald-500/5 text-emerald-500"}`}>{notice.text}</p>}
    {editor !== null && <section className="rounded-xl border border-accent/30 bg-bg-card p-4" aria-label={editor === "new" ? t("newFunction") : t("editFunction")}><h3 className="mb-4 text-[15px] font-semibold">{editor === "new" ? t("newFunction") : t("editFunction")}</h3><FunctionFields id={`${prefix}-editor`} form={form} onChange={setForm} gifts={allGifts} t={t} disabled={locked} allowUnclassified={editor !== "new" && categoryOf(functions.find(item => item.id === editor) || {}) === "unclassified"} />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><label className={buttonClass}><ImagePlus size={15} aria-hidden="true" />{uploading ? t("uploading") : t("upload")}<input aria-label={t("upload")} className="sr-only" type="file" accept={IMAGE_ACCEPT} disabled={locked} onChange={event => { const file = event.target.files?.[0]; if (file) void uploadSingle(file); event.target.value = "" }} /></label><div className="flex gap-2"><button type="button" disabled={locked} className={buttonClass} onClick={() => setEditor(null)}>{t("cancel")}</button><button type="button" disabled={locked} className={primaryClass} onClick={save}>{busy ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Check size={14} aria-hidden="true" />}{busy ? t("saving") : t("save")}</button></div></div>
    </section>}
    {bulkCategory !== null && <section className="rounded-xl border border-accent/30 bg-bg-card p-4" aria-labelledby={`${prefix}-bulk`}><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 id={`${prefix}-bulk`} className="text-[15px] font-semibold">{t("bulkAdd")}</h3><p className="mt-1 text-[12px] text-text-muted">{t("bulkHint", { count: BULK_LIMIT })}</p></div><button type="button" disabled={locked} className={buttonClass} onClick={clearStaging} aria-label={t("cancel")}><X size={16} aria-hidden="true" /></button></div>
      <label className={`${buttonClass} my-4 cursor-pointer`}><Images size={16} aria-hidden="true" />{t("chooseImages")}<input aria-label={t("chooseImages")} className="sr-only" type="file" multiple accept={IMAGE_ACCEPT} disabled={locked} onChange={event => { stageFiles(event.target.files); event.target.value = "" }} /></label>
      <div className="space-y-4">{staged.map((row, index) => <div key={row.id} data-staged-id={row.id} className="rounded-lg border border-accent/15 p-3"><div className="mb-3 flex items-center gap-3"><Image src={row.preview} alt="" width={42} height={42} className="h-10 w-10 rounded object-contain" unoptimized /><div className="min-w-0 flex-1"><p className="truncate text-[12px] font-medium">{row.file.name}</p><p role="status" className="text-[11px] text-text-muted">{row.state === "uploading" ? t("uploadProgress", { percent: row.progress }) : row.state === "uploaded" ? t("uploaded") : t("ready")}</p></div><button type="button" disabled={locked} className={buttonClass} aria-label={t("removeStaged", { name: row.file.name })} onClick={() => { URL.revokeObjectURL(row.preview); previews.current.delete(row.preview); setStaged(current => current.filter(item => item.id !== row.id)) }}><Trash2 size={14} aria-hidden="true" /></button></div>
        <FunctionFields id={`${prefix}-bulk-${index}`} form={row} onChange={next => stage(row.id, next)} gifts={allGifts} t={t} disabled={locked} />{row.error && <p role="alert" className="mt-2 text-[12px] text-red-400">{row.error}</p>}
      </div>)}</div>
      {staged.length > 0 && <div className="mt-4 flex justify-end"><button type="button" disabled={locked} className={primaryClass} onClick={submitBulk}>{bulkBusy ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : staged.some(row => row.state === "error") ? <RotateCcw size={15} aria-hidden="true" /> : <Plus size={15} aria-hidden="true" />}{bulkBusy ? t("bulkWorking") : t("bulkSubmit", { count: staged.length })}</button></div>}
    </section>}
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">{section("help")}{section("troll")}</div>
    {section("neutral")}{section("unclassified")}
  </div>
}

function FunctionFields({ id, form, onChange, gifts, t, disabled, allowUnclassified }: { id: string; form: FunctionDraft; onChange: (next: FunctionDraft) => void; gifts: Gift[]; t: Translate; disabled: boolean; allowUnclassified?: boolean }) {
  const gift = gifts.find(item => item.id === form.default_gift_id), like = gift?.trigger_type?.toLowerCase() === "like"
  const field = (key: "name" | "label_th" | "label_en" | "image_url", label: string, maxLength: number) => <div><label className="mb-1.5 block text-[12px] text-text-muted" htmlFor={`${id}-${key}`}>{label}</label><input id={`${id}-${key}`} value={form[key]} maxLength={maxLength} className={inputClass} disabled={disabled} aria-describedby={key === "name" ? `${id}-key-hint` : undefined} onChange={event => onChange({ ...form, [key]: event.target.value })} />{key === "name" && <p id={`${id}-key-hint`} className="mt-1 text-[11px] text-text-muted">{t("keyHint")}</p>}</div>
  return <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
    {field("name", t("nameKey"), 120)}<div><label htmlFor={`${id}-category`} className="mb-1.5 block text-[12px] text-text-muted">{t("category")}</label><select id={`${id}-category`} className={inputClass} disabled={disabled} value={form.category} onChange={event => onChange({ ...form, category: event.target.value as FunctionCategory })}>{allowUnclassified && <option value="">{t("unclassified")}</option>}{categories.map(category => <option key={category} value={category}>{t(category)}</option>)}</select></div>
    {field("label_th", t("labelTh"), 200)}{field("label_en", t("labelEn"), 200)}
    <div><label className="mb-1.5 block text-[12px] text-text-muted" htmlFor={`${id}-gift`}>{t("defaultGift")}</label><FunctionGiftPicker id={`${id}-gift`} label={t("defaultGift")} gifts={gifts} value={form.default_gift_id} disabled={disabled} onChange={value => onChange({ ...form, default_gift_id: value, default_trigger_threshold: "" })} placeholder={t("noDefault")} noOptions={t("noGiftsFound")} unavailable={t("giftUnavailable", { id: form.default_gift_id || "" })} /></div>
    {form.default_gift_id !== null && <div><label className="mb-1.5 block text-[12px] text-text-muted" htmlFor={`${id}-threshold`}>{t("defaultThreshold")}</label>{like ? <select id={`${id}-threshold`} value={form.default_trigger_threshold} className={inputClass} disabled={disabled} onChange={event => onChange({ ...form, default_trigger_threshold: event.target.value })}><option value="">{t("noDefault")}</option>{LIKE_THRESHOLDS.map(value => <option key={value} value={value}>{value}</option>)}</select> : <input id={`${id}-threshold`} type="number" min="1" max="10000" step="1" value={form.default_trigger_threshold} className={inputClass} disabled={disabled} placeholder={t("optional")} onChange={event => onChange({ ...form, default_trigger_threshold: event.target.value })} />}</div>}
    <div className="sm:col-span-2">{field("image_url", t("imageUrl"), 2048)}</div>
  </div>
}
