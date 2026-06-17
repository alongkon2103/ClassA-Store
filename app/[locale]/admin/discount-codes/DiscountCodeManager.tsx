"use client"

import { useState } from "react"

type DiscountCode = {
  id: string
  code: string
  type: string
  value: number
  max_uses: number | null
  used_count: number
  per_user_limit: number | null
  min_amount: number | null
  product_id: string | null
  product_name: string | null
  starts_at: string | null
  expires_at: string | null
  is_active: boolean
  note: string | null
  redemption_count: number
}

type Product = { id: string; name: string }

type FormState = {
  code: string
  type: "fixed" | "percent"
  value: string
  max_uses: string
  per_user_limit: string
  min_amount: string
  product_id: string
  starts_at: string
  expires_at: string
  note: string
}

const EMPTY_FORM: FormState = {
  code: "",
  type: "fixed",
  value: "",
  max_uses: "",
  per_user_limit: "1",
  min_amount: "",
  product_id: "",
  starts_at: "",
  expires_at: "",
  note: "",
}

// Convert an ISO timestamp ("2026-12-31T17:00:00.000Z") to the
// "yyyy-MM-ddTHH:mm" format that <input type="datetime-local"> expects,
// in the user's local timezone.
function toLocalDatetime(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function codeToForm(c: DiscountCode): FormState {
  return {
    code: c.code,
    type: c.type === "percent" ? "percent" : "fixed",
    value: String(c.value),
    max_uses: c.max_uses === null ? "" : String(c.max_uses),
    per_user_limit: c.per_user_limit === null ? "" : String(c.per_user_limit),
    min_amount: c.min_amount === null ? "" : String(c.min_amount),
    product_id: c.product_id ?? "",
    starts_at: toLocalDatetime(c.starts_at),
    expires_at: toLocalDatetime(c.expires_at),
    note: c.note ?? "",
  }
}

export default function DiscountCodeManager({
  initialCodes,
  products,
}: {
  initialCodes: DiscountCode[]
  products: Product[]
}) {
  const [codes, setCodes] = useState<DiscountCode[]>(initialCodes)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startCreate = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setError(null)
    setShowForm(true)
  }

  const startEdit = (c: DiscountCode) => {
    setEditingId(c.id)
    setForm(codeToForm(c))
    setError(null)
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingId(null)
    setError(null)
  }

  const handleSave = async () => {
    setError(null)
    if (!form.value || Number(form.value) <= 0) {
      setError("Please enter a discount value")
      return
    }
    setSaving(true)
    try {
      const payload = {
        code: form.code || undefined,
        type: form.type,
        value: Number(form.value),
        max_uses: form.max_uses ? Number(form.max_uses) : null,
        per_user_limit: form.per_user_limit === "" ? null : Number(form.per_user_limit),
        min_amount: form.min_amount ? Number(form.min_amount) : null,
        product_id: form.product_id || null,
        starts_at: form.starts_at || null,
        expires_at: form.expires_at || null,
        note: form.note || null,
      }

      const url = editingId ? `/api/admin/discount-codes/${editingId}` : "/api/admin/discount-codes"
      const method = editingId ? "PATCH" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Failed to save")
        setSaving(false)
        return
      }

      const productName = form.product_id
        ? products.find((p) => p.id === form.product_id)?.name ?? null
        : null

      const mapped: DiscountCode = {
        id: data.id,
        code: data.code,
        type: data.type,
        value: Number(data.value),
        max_uses: data.max_uses,
        used_count: data.used_count,
        per_user_limit: data.per_user_limit,
        min_amount: data.min_amount ? Number(data.min_amount) : null,
        product_id: data.product_id,
        product_name: productName,
        starts_at: data.starts_at,
        expires_at: data.expires_at,
        is_active: data.is_active,
        note: data.note,
        redemption_count: editingId
          ? codes.find((c) => c.id === editingId)?.redemption_count ?? 0
          : 0,
      }

      setCodes(
        editingId
          ? codes.map((c) => (c.id === editingId ? mapped : c))
          : [mapped, ...codes],
      )
      closeForm()
    } catch {
      setError("Network error")
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (id: string, currentActive: boolean) => {
    const res = await fetch(`/api/admin/discount-codes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !currentActive }),
    })
    if (res.ok) {
      setCodes(codes.map((c) => (c.id === id ? { ...c, is_active: !currentActive } : c)))
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this code?")) return
    const res = await fetch(`/api/admin/discount-codes/${id}`, { method: "DELETE" })
    if (res.ok) setCodes(codes.filter((c) => c.id !== id))
  }

  const fmt = (s: string | null) =>
    s ? new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-[22px] sm:text-[26px] font-bold">Discount Codes</h1>
          <p className="text-text-muted text-[12px] sm:text-[13px] mt-1">
            Create and manage promotional codes for customers.
          </p>
        </div>
        <button
          onClick={() => (showForm ? closeForm() : startCreate())}
          className="px-4 py-2 rounded-xl bg-accent text-white text-[13px] font-medium hover:bg-accent/90 self-start sm:self-auto"
        >
          {showForm ? "Cancel" : "+ New Code"}
        </button>
      </div>

      {showForm && (
        <div className="bg-bg-card border border-accent/15 rounded-2xl p-5 space-y-4">
          <p className="text-[13px] font-semibold">
            {editingId ? `Edit Code` : "New Code"}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] text-text-muted mb-1.5 uppercase tracking-wider">
                Code {!editingId && "(leave empty to auto-generate)"}
              </label>
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="SUMMER50"
                className="w-full bg-bg-base border border-accent/15 rounded-xl px-3 py-2 text-[14px] uppercase"
              />
            </div>

            <div>
              <label className="block text-[11px] text-text-muted mb-1.5 uppercase tracking-wider">
                Type
              </label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as "fixed" | "percent" })}
                className="w-full bg-bg-base border border-accent/15 rounded-xl px-3 py-2 text-[14px]"
              >
                <option value="fixed">Fixed amount (฿)</option>
                <option value="percent">Percent (%)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-text-muted mb-1.5 uppercase tracking-wider">
                Value {form.type === "fixed" ? "(฿)" : "(%)"}
              </label>
              <input
                type="number"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                placeholder={form.type === "fixed" ? "50" : "10"}
                className="w-full bg-bg-base border border-accent/15 rounded-xl px-3 py-2 text-[14px]"
              />
            </div>

            <div>
              <label className="block text-[11px] text-text-muted mb-1.5 uppercase tracking-wider">
                Max total uses (empty = unlimited)
              </label>
              <input
                type="number"
                value={form.max_uses}
                onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
                placeholder="100"
                className="w-full bg-bg-base border border-accent/15 rounded-xl px-3 py-2 text-[14px]"
              />
            </div>

            <div>
              <label className="block text-[11px] text-text-muted mb-1.5 uppercase tracking-wider">
                Per-user limit (1 = once per person, empty = unlimited)
              </label>
              <input
                type="number"
                value={form.per_user_limit}
                onChange={(e) => setForm({ ...form, per_user_limit: e.target.value })}
                placeholder="1"
                className="w-full bg-bg-base border border-accent/15 rounded-xl px-3 py-2 text-[14px]"
              />
            </div>

            <div>
              <label className="block text-[11px] text-text-muted mb-1.5 uppercase tracking-wider">
                Min order (฿, optional)
              </label>
              <input
                type="number"
                value={form.min_amount}
                onChange={(e) => setForm({ ...form, min_amount: e.target.value })}
                placeholder="0"
                className="w-full bg-bg-base border border-accent/15 rounded-xl px-3 py-2 text-[14px]"
              />
            </div>

            <div>
              <label className="block text-[11px] text-text-muted mb-1.5 uppercase tracking-wider">
                Product (empty = all)
              </label>
              <select
                value={form.product_id}
                onChange={(e) => setForm({ ...form, product_id: e.target.value })}
                className="w-full bg-bg-base border border-accent/15 rounded-xl px-3 py-2 text-[14px]"
              >
                <option value="">All products</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-text-muted mb-1.5 uppercase tracking-wider">
                Starts at (optional)
              </label>
              <input
                type="datetime-local"
                value={form.starts_at}
                onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                className="w-full bg-bg-base border border-accent/15 rounded-xl px-3 py-2 text-[14px]"
              />
            </div>

            <div>
              <label className="block text-[11px] text-text-muted mb-1.5 uppercase tracking-wider">
                Expires at (optional)
              </label>
              <input
                type="datetime-local"
                value={form.expires_at}
                onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
                className="w-full bg-bg-base border border-accent/15 rounded-xl px-3 py-2 text-[14px]"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] text-text-muted mb-1.5 uppercase tracking-wider">
                Note (internal)
              </label>
              <input
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder="Summer 2026 campaign"
                className="w-full bg-bg-base border border-accent/15 rounded-xl px-3 py-2 text-[14px]"
              />
            </div>
          </div>

          {error && <p className="text-[13px] text-red-400">{error}</p>}

          <div className="flex gap-2 justify-end">
            <button
              onClick={closeForm}
              className="px-4 py-2 rounded-xl text-text-muted text-[13px] hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-accent text-white text-[13px] font-medium hover:bg-accent/90 disabled:opacity-50"
            >
              {saving ? "Saving..." : editingId ? "Save Changes" : "Create"}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-bg-card border border-accent/10 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] text-text-muted border-b border-white/5">
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Discount</th>
                <th className="px-4 py-3 font-medium">Used</th>
                <th className="px-4 py-3 font-medium">Per User</th>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Expires</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {codes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-text-muted">
                    No discount codes yet.
                  </td>
                </tr>
              ) : (
                codes.map((c) => (
                  <tr key={c.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-mono font-semibold">{c.code}</td>
                    <td className="px-4 py-3">
                      {c.type === "fixed" ? `฿${c.value.toLocaleString()}` : `${c.value}%`}
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      {c.used_count}
                      {c.max_uses !== null ? ` / ${c.max_uses}` : " / ∞"}
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      {c.per_user_limit === null ? "∞" : c.per_user_limit}
                    </td>
                    <td className="px-4 py-3 text-text-muted">{c.product_name ?? "All"}</td>
                    <td className="px-4 py-3 text-text-muted">{fmt(c.expires_at)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${c.is_active
                          ? "bg-green-500/15 text-green-400"
                          : "bg-white/10 text-text-muted"
                          }`}
                      >
                        {c.is_active ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-3">
                        <button
                          onClick={() => startEdit(c)}
                          className="text-[12px] text-accent-light hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleToggle(c.id, c.is_active)}
                          className="text-[12px] text-text-muted hover:underline"
                        >
                          {c.is_active ? "Disable" : "Enable"}
                        </button>
                        <button
                          onClick={() => handleDelete(c.id)}
                          className="text-[12px] text-red-400 hover:underline"
                        >
                          Delete
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
