"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"

type Partner = {
  id: string
  name: string
  contact: string | null
  bank_name: string | null
  account_number: string | null
  created_at: string
}

type Props = {
  initialPartners: Partner[]
}

const EMPTY_FORM = {
  name: "",
  contact: "",
  bank_name: "",
  account_number: "",
}

export default function PartnerManagerClient({ initialPartners }: Props) {
  const t = useTranslations("AdminPartners")
  const [partners, setPartners] = useState<Partner[]>(initialPartners)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const setF = (key: keyof typeof EMPTY_FORM, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const openAdd = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  const openEdit = (partner: Partner) => {
    setEditingId(partner.id)
    setForm({
      name: partner.name,
      contact: partner.contact ?? "",
      bank_name: partner.bank_name ?? "",
      account_number: partner.account_number ?? "",
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      alert(t("name_required"))
      return
    }

    try {
      setSaving(true)
      const isEdit = editingId !== null
      const url = isEdit ? `/api/admin/partners/${editingId}` : "/api/admin/partners"
      const method = isEdit ? "PATCH" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })

      const data = await res.json()
      if (!res.ok) {
        alert(data.error || t("save_failed"))
        return
      }

      if (isEdit) {
        setPartners((prev) => prev.map((p) => (p.id === editingId ? data : p)))
      } else {
        setPartners((prev) => [data, ...prev])
      }
      setShowForm(false)
      setForm(EMPTY_FORM)
    } catch (error) {
      console.error(error)
      alert(t("save_failed"))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t("delete_confirm"))) return
    try {
      const res = await fetch(`/api/admin/partners/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error || t("delete_failed"))
        return
      }
      setPartners((prev) => prev.filter((p) => p.id !== id))
    } catch (error) {
      console.error(error)
      alert(t("delete_failed"))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-text-base">{t("title")}</h1>
          <p className="text-[13px] text-text-muted mt-0.5">{t("subtitle")}</p>
        </div>
        <button
          onClick={openAdd}
          className="bg-accent/20 hover:bg-accent/30 text-accent-light text-[13px] font-medium px-4 py-2.5 rounded-xl transition"
        >
          {t("add_new")}
        </button>
      </div>

      {showForm && (
        <div className="bg-bg-card border border-accent/15 rounded-2xl p-5 space-y-4 shadow-lg shadow-black/5">
          <p className="text-[12px] text-text-muted uppercase tracking-wide font-medium">
            {editingId ? t("edit_partner") : t("new_partner")}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] text-text-muted mb-1.5">{t("name")} *</label>
              <input value={form.name} onChange={(e) => setF("name", e.target.value)} className={input} />
            </div>
            <div>
              <label className="block text-[11px] text-text-muted mb-1.5">{t("contact")}</label>
              <input value={form.contact} onChange={(e) => setF("contact", e.target.value)} className={input} />
            </div>
            <div>
              <label className="block text-[11px] text-text-muted mb-1.5">{t("bank_name")}</label>
              <input value={form.bank_name} onChange={(e) => setF("bank_name", e.target.value)} className={input} />
            </div>
            <div>
              <label className="block text-[11px] text-text-muted mb-1.5">{t("account_number")}</label>
              <input value={form.account_number} onChange={(e) => setF("account_number", e.target.value)} className={input} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-text-muted hover:text-text-base transition">
              {t("cancel")}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-accent text-white px-5 py-2 rounded-xl disabled:opacity-50 transition font-bold"
            >
              {saving ? t("saving") : t("save")}
            </button>
          </div>
        </div>
      )}

      <div className="bg-bg-card border border-accent/10 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
        <table className="w-full text-[13px] min-w-[700px]">
          <thead>
            <tr className="text-left text-[11px] text-text-muted border-b border-white/5 bg-accent/5">
              <th className="px-5 py-3.5 font-medium">{t("col_name")}</th>
              <th className="px-4 py-3.5 font-medium">{t("col_contact")}</th>
              <th className="px-4 py-3.5 font-medium">{t("col_bank")}</th>
              <th className="px-4 py-3.5 font-medium text-right">{t("col_actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {partners.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-10 text-text-muted">{t("no_partners")}</td>
              </tr>
            ) : (
              partners.map((p) => (
                <tr key={p.id} className="hover:bg-accent/5 transition text-text-base">
                  <td className="px-5 py-4 font-medium">{p.name}</td>
                  <td className="px-4 py-4 text-text-muted">{p.contact || "—"}</td>
                  <td className="px-4 py-4">
                    <div className="text-[12px]">
                      <p className="font-semibold text-text-base">{p.bank_name || "—"}</p>
                      <p className="text-text-muted">{p.account_number || "—"}</p>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => openEdit(p)} className="p-2 rounded-lg border border-accent/10 hover:bg-accent/10 transition text-text-muted hover:text-text-base">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button onClick={() => handleDelete(p.id)} className="p-2 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 transition">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}

const input = "w-full bg-bg-base border border-accent/15 rounded-xl px-4 py-2.5 text-[13px] text-text-base placeholder:text-text-muted outline-none focus:border-accent/40 transition"
