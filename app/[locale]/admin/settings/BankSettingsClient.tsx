"use client"

import { useState, useRef } from "react"
import { useTranslations } from "next-intl"
import type { bank_accounts } from "@prisma/client"

const blank = {
  bank_name: "", account_name: "", account_number: "",
  promptpay_no: "", qr_code_url: "", is_active: true,
}

export default function BankSettingsClient({ banks }: { banks: bank_accounts[] }) {
  const t = useTranslations("Admin")
  const [list, setList]     = useState(banks)
  const [form, setForm]     = useState({ ...blank })
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.bank_name || !form.account_name || !form.account_number) {
      alert("Please fill in all required fields")
      return
    }
    setSaving(true)
    const url    = editId ? `/api/admin/bank-accounts/${editId}` : "/api/admin/bank-accounts"
    const method = editId ? "PATCH" : "POST"
    const res    = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { alert(data.error); return }

    if (editId) {
      setList((l) => l.map((b) => b.id === editId ? data : b))
      setEditId(null)
    } else {
      setList((l) => [data, ...l])
    }
    setForm({ ...blank })
    setAdding(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t("delete_confirm"))) return
    await fetch(`/api/admin/bank-accounts/${id}`, { method: "DELETE" })
    setList((l) => l.filter((b) => b.id !== id))
  }

  const handleToggle = async (id: string, current: boolean | null) => {
    await fetch(`/api/admin/bank-accounts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !current }),
    })
    setList((l) => l.map((b) => b.id === id ? { ...b, is_active: !current } : b))
  }

  const handleEdit = (bank: bank_accounts) => {
    setForm({
      bank_name:      bank.bank_name,
      account_name:   bank.account_name,
      account_number: bank.account_number,
      promptpay_no:   bank.promptpay_no ?? "",
      qr_code_url:    bank.qr_code_url  ?? "",
      is_active:      bank.is_active    ?? true,
    })
    setEditId(bank.id)
    setAdding(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-bold">{t("payment_settings")}</h1>
          <p className="text-text-muted text-[13px] mt-0.5">{t("manage_payments")}</p>
        </div>
        {!adding && (
          <button
            onClick={() => { setForm({ ...blank }); setEditId(null); setAdding(true) }}
            className="bg-accent hover:opacity-90 text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl transition active:scale-95"
          >
            + {t("add_account")}
          </button>
        )}
      </div>

      {/* Form */}
      {adding && (
        <div className="bg-bg-card border border-accent/20 rounded-2xl p-5 space-y-4">
          <p className="text-[15px] font-semibold">{editId ? t("edit_account") : t("new_account")}</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>{t("bank_name")} *</label>
              <input
                value={form.bank_name}
                onChange={(e) => set("bank_name", e.target.value)}
                placeholder="Kasikorn / SCB / PromptPay"
                className={inp}
              />
            </div>
            <div>
              <label className={lbl}>{t("account_name")} *</label>
              <input
                value={form.account_name}
                onChange={(e) => set("account_name", e.target.value)}
                placeholder="Full name"
                className={inp}
              />
            </div>
            <div>
              <label className={lbl}>{t("account_number")} *</label>
              <input
                value={form.account_number}
                onChange={(e) => set("account_number", e.target.value)}
                placeholder="xxx-x-xxxxx-x"
                className={inp}
              />
            </div>
            <div>
              <label className={lbl}>{t("promptpay_no")}</label>
              <input
                value={form.promptpay_no}
                onChange={(e) => set("promptpay_no", e.target.value)}
                placeholder="0812345678"
                className={inp}
              />
            </div>
          </div>

          {/* QR Upload */}
          <div>
            <label className={lbl}>{t("qr_code")}</label>
            {form.qr_code_url ? (
              <div className="flex items-center gap-4">
                <div className="bg-white rounded-xl p-2">
                  <img src={form.qr_code_url} className="w-20 h-20 object-contain" />
                </div>
                <button
                  onClick={() => set("qr_code_url", "")}
                  className="text-[12px] px-3 py-1.5 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 transition"
                >
                  {t("remove_qr")}
                </button>
              </div>
            ) : (
              <QRUpload onUploaded={(url) => set("qr_code_url", url)} />
            )}
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <button
              onClick={() => { setAdding(false); setEditId(null); setForm({ ...blank }) }}
              className="px-4 py-2 rounded-xl border border-white/10 text-text-muted text-[13px] hover:text-text-base transition"
            >
              {t("cancel")}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-accent text-white text-[13px] font-semibold hover:opacity-90 transition disabled:opacity-50"
            >
              {saving ? t("saving") : editId ? t("save_changes") : t("add_account")}
            </button>
          </div>
        </div>
      )}

      {/* Account List */}
      <div className="space-y-3">
        {list.length === 0 && (
          <div className="text-center py-16 text-text-muted text-[13px] bg-bg-card border border-accent/10 rounded-2xl">
            {t("no_accounts")}
          </div>
        )}

        {list.map((bank) => (
          <div
            key={bank.id}
            className={`bg-bg-card border rounded-2xl p-5 flex items-center gap-5 transition ${
              bank.is_active ? "border-accent/15" : "border-white/5 opacity-50"
            }`}
          >
            {/* QR preview */}
            {bank.qr_code_url ? (
              <div className="bg-white rounded-xl p-1.5 flex-shrink-0">
                <img src={bank.qr_code_url} className="w-14 h-14 object-contain" />
              </div>
            ) : (
              <div className="w-14 h-14 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-accent-light">
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <path d="M14 14h3v3M17 17h3v3M14 17h.01" />
                </svg>
              </div>
            )}

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="font-semibold text-[14px]">{bank.bank_name}</p>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  bank.is_active
                    ? "bg-green-500/15 text-green-400"
                    : "bg-white/5 text-text-muted"
                }`}>
                  {bank.is_active ? t("active") : t("inactive")}
                </span>
              </div>
              <p className="text-[13px] text-text-muted">{bank.account_name}</p>
              <p className="text-[13px] font-mono">{bank.account_number}</p>
              {bank.promptpay_no && (
                <p className="text-[12px] text-text-muted mt-0.5">
                  {t("promptpay_no")}: {bank.promptpay_no}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 flex-shrink-0">
              <button
                onClick={() => handleEdit(bank)}
                className="text-[12px] px-3 py-1.5 rounded-lg border border-accent/20 text-accent-light hover:bg-accent/10 transition"
              >
                {t("edit")}
              </button>
              <button
                onClick={() => handleToggle(bank.id, bank.is_active)}
                className="text-[12px] px-3 py-1.5 rounded-lg border border-white/10 text-text-muted hover:text-text-base transition"
              >
                {bank.is_active ? t("disable") : t("enable")}
              </button>
              <button
                onClick={() => handleDelete(bank.id)}
                className="text-[12px] px-3 py-1.5 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 transition"
              >
                {t("delete")}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function QRUpload({ onUploaded }: { onUploaded: (url: string) => void }) {
  const t = useTranslations("Admin")
  const [uploading, setUploading] = useState(false)
  const ref = useRef<HTMLInputElement>(null)

  const handle = async (file: File) => {
    setUploading(true)
    const fd = new FormData()
    fd.append("file", file)
    fd.append("type", "image")
    const res  = await fetch("/api/admin/upload", { method: "POST", body: fd })
    const data = await res.json()
    setUploading(false)
    if (res.ok) onUploaded(data.url)
  }

  return (
    <div
      onClick={() => ref.current?.click()}
      className="border-2 border-dashed border-accent/20 hover:border-accent/40 hover:bg-white/[0.02] rounded-xl p-8 text-center cursor-pointer transition"
    >
      <div className="w-10 h-10 mx-auto mb-3 rounded-xl bg-accent/10 flex items-center justify-center">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-accent-light">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      </div>
      <p className="text-[13px] text-text-muted">
        {uploading ? t("uploading") : (
          <>{t.rich("upload_qr", {
            browse: (chunks) => <span className="text-accent-light underline underline-offset-2">{chunks}</span>
          })}</>
        )}
      </p>
      <p className="text-[11px] text-text-muted/50 mt-1">{t("upload_hint")}</p>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handle(f) }}
      />
    </div>
  )
}

const lbl = "block text-[11px] text-text-muted uppercase tracking-wide mb-1.5"
const inp = "w-full bg-bg-base border border-accent/15 rounded-xl px-3 py-2.5 text-[13px] placeholder:text-text-muted outline-none focus:border-accent/40 transition"
