"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"

type ProductFunction = {
  id: string
  product_id: string
  name: string
  label_th: string | null
  label_en: string | null
  sort_order: number
  created_at: string | null
}

type Props = {
  productId: string
  functions: ProductFunction[]
}

export default function FunctionManager({
  productId,
  functions: initial,
}: Props) {
  const t = useTranslations("AdminFunctions")

  const [functions, setFunctions] = useState<ProductFunction[]>(
    [...initial].sort((a, b) => a.sort_order - b.sort_order)
  )

  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Add form
  const [newForm, setNewForm] = useState({
    name: "",
    label_th: "",
    label_en: "",
  })
  const [adding, setAdding] = useState(false)
  const [showAdd, setShowAdd] = useState(false)

  // Edit form
  const [editForm, setEditForm] = useState({
    name: "",
    label_th: "",
    label_en: "",
  })

  // ─────────────────────────────────────────────
  // Add Function
  // ─────────────────────────────────────────────
  const handleAdd = async () => {
    if (!newForm.name.trim()) return

    try {
      setAdding(true)

      const res = await fetch(
        `/api/admin/products/${productId}/functions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: newForm.name.trim().toLowerCase(),
            label_th: newForm.label_th.trim() || null,
            label_en: newForm.label_en.trim() || null,
            sort_order: functions.length,
          }),
        }
      )

      const data = await res.json()

      if (!res.ok) {
        alert(data.error || t("error"))
        return
      }

      setFunctions((prev) =>
        [...prev, data].sort(
          (a, b) => a.sort_order - b.sort_order
        )
      )

      setNewForm({
        name: "",
        label_th: "",
        label_en: "",
      })

      setShowAdd(false)
    } catch (error) {
      console.error("Add error:", error)
      alert(t("error"))
    } finally {
      setAdding(false)
    }
  }

  // ─────────────────────────────────────────────
  // Start Edit
  // ─────────────────────────────────────────────
  const startEdit = (fn: ProductFunction) => {
    setEditingId(fn.id)
    setEditForm({
      name: fn.name,
      label_th: fn.label_th ?? "",
      label_en: fn.label_en ?? "",
    })
  }

  // ─────────────────────────────────────────────
  // Save Edit
  // ─────────────────────────────────────────────
  const handleEdit = async (id: string) => {
    try {
      setLoading(true)

      const res = await fetch(
        `/api/admin/products/${productId}/functions/${id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: editForm.name.trim().toLowerCase(),
            label_th: editForm.label_th.trim() || null,
            label_en: editForm.label_en.trim() || null,
          }),
        }
      )

      const data = await res.json()

      if (!res.ok) {
        alert(data.error || t("error"))
        return
      }

      setFunctions((prev) =>
        prev.map((f) => (f.id === id ? data : f))
      )

      setEditingId(null)
    } catch (error) {
      console.error("Edit error:", error)
      alert(t("error"))
    } finally {
      setLoading(false)
    }
  }

  // ─────────────────────────────────────────────
  // Delete
  // ─────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (!confirm(t("deleteConfirm"))) return

    try {
      setLoading(true)

      const res = await fetch(
        `/api/admin/products/${productId}/functions/${id}`,
        {
          method: "DELETE",
        }
      )

      if (!res.ok) {
        alert(t("error"))
        return
      }

      setFunctions((prev) =>
        prev.filter((f) => f.id !== id)
      )
    } catch (error) {
      console.error("Delete error:", error)
      alert(t("error"))
    } finally {
      setLoading(false)
    }
  }

  // ─────────────────────────────────────────────
  // Reorder
  // ─────────────────────────────────────────────
  const move = async (
    index: number,
    dir: -1 | 1
  ) => {
    const next = [...functions]
    const swapIndex = index + dir

    if (
      swapIndex < 0 ||
      swapIndex >= next.length
    ) {
      return
    }

    ;[next[index], next[swapIndex]] = [
      next[swapIndex],
      next[index],
    ]

    const updated = next.map((f, i) => ({
      ...f,
      sort_order: i,
    }))

    setFunctions(updated)

    try {
      await fetch(
        `/api/admin/products/${productId}/functions/reorder`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(
            updated.map((f) => ({
              id: f.id,
              sort_order: f.sort_order,
            }))
          ),
        }
      )
    } catch (error) {
      console.error("Reorder error:", error)
      alert(t("error"))
    }
  }

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[14px] font-semibold">
            {t("title")}
          </p>
          <p className="text-[12px] text-text-muted mt-0.5">
            {t("subtitle")}
          </p>
        </div>

        <button
          onClick={() =>
            setShowAdd((prev) => !prev)
          }
          className="flex items-center gap-2 bg-accent/20 hover:bg-accent/30 text-accent-light text-[13px] font-medium px-4 py-2 rounded-xl transition"
        >
          <span className="text-[16px] leading-none">
            +
          </span>
          {t("addFunction")}
        </button>
      </div>

      {/* Add Form */}
      {showAdd && (
        <div className="bg-bg-card border border-accent/15 rounded-2xl p-4 space-y-3">
          <p className="text-[12px] text-text-muted uppercase tracking-wide font-medium">
            {t("newFunction")}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Name */}
            <div>
              <label className="block text-[11px] text-text-muted mb-1">
                {t("nameKey")}{" "}
                <span className="text-red-400">
                  *
                </span>
              </label>
              <input
                value={newForm.name}
                onChange={(e) =>
                  setNewForm((prev) => ({
                    ...prev,
                    name: e.target.value,
                  }))
                }
                placeholder="kill"
                className={input}
              />
            </div>

            {/* Label TH */}
            <div>
              <label className="block text-[11px] text-text-muted mb-1">
                {t("labelTh")}
              </label>
              <input
                value={newForm.label_th}
                onChange={(e) =>
                  setNewForm((prev) => ({
                    ...prev,
                    label_th: e.target.value,
                  }))
                }
                placeholder="สังหาร"
                className={input}
              />
            </div>

            {/* Label EN */}
            <div>
              <label className="block text-[11px] text-text-muted mb-1">
                {t("labelEn")}
              </label>
              <input
                value={newForm.label_en}
                onChange={(e) =>
                  setNewForm((prev) => ({
                    ...prev,
                    label_en: e.target.value,
                  }))
                }
                placeholder="Kill"
                className={input}
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <button
              onClick={() => {
                setShowAdd(false)
                setNewForm({
                  name: "",
                  label_th: "",
                  label_en: "",
                })
              }}
              className="text-[13px] text-text-muted hover:text-text-base px-4 py-2 rounded-xl transition"
            >
              {t("cancel")}
            </button>

            <button
              onClick={handleAdd}
              disabled={
                adding ||
                !newForm.name.trim()
              }
              className="bg-accent hover:opacity-90 text-white text-[13px] font-semibold px-5 py-2 rounded-xl transition disabled:opacity-50"
            >
              {adding
                ? t("saving")
                : t("save")}
            </button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {functions.length === 0 &&
        !showAdd && (
          <div className="text-center py-12 text-text-muted text-[13px] bg-bg-card border border-accent/10 rounded-2xl">
            {t("empty")}
          </div>
        )}

      {/* Function List */}
      {functions.length > 0 && (
        <div className="space-y-2">
          {functions.map((fn, i) => (
            <div
              key={fn.id}
              className="bg-bg-card border border-accent/10 rounded-2xl px-4 py-3 flex items-center gap-3"
            >
              {/* Reorder Buttons */}
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() =>
                    move(i, -1)
                  }
                  disabled={
                    i === 0 || loading
                  }
                  className="text-text-muted hover:text-text-base disabled:opacity-20 text-[11px] leading-none px-1"
                >
                  ▲
                </button>
                <button
                  onClick={() =>
                    move(i, 1)
                  }
                  disabled={
                    i ===
                      functions.length -
                        1 || loading
                  }
                  className="text-text-muted hover:text-text-base disabled:opacity-20 text-[11px] leading-none px-1"
                >
                  ▼
                </button>
              </div>

              {/* Sort Number */}
              <span className="text-[11px] text-text-muted w-5 text-center">
                {i + 1}
              </span>

              {/* Content */}
              {editingId === fn.id ? (
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    value={editForm.name}
                    onChange={(e) =>
                      setEditForm(
                        (prev) => ({
                          ...prev,
                          name: e.target.value,
                        })
                      )
                    }
                    placeholder="kill"
                    className={input}
                  />
                  <input
                    value={editForm.label_th}
                    onChange={(e) =>
                      setEditForm(
                        (prev) => ({
                          ...prev,
                          label_th:
                            e.target.value,
                        })
                      )
                    }
                    placeholder="Label TH"
                    className={input}
                  />
                  <input
                    value={editForm.label_en}
                    onChange={(e) =>
                      setEditForm(
                        (prev) => ({
                          ...prev,
                          label_en:
                            e.target.value,
                        })
                      )
                    }
                    placeholder="Label EN"
                    className={input}
                  />
                </div>
              ) : (
                <div className="flex-1 flex items-center gap-3 flex-wrap">
                  <span className="font-mono text-[13px] bg-accent/10 text-accent-light px-2 py-0.5 rounded-lg">
                    {fn.name}
                  </span>

                  {fn.label_th && (
                    <span className="text-[13px] text-text-base">
                      {fn.label_th}
                    </span>
                  )}

                  {fn.label_en && (
                    <span className="text-[12px] text-text-muted">
                      / {fn.label_en}
                    </span>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {editingId === fn.id ? (
                  <>
                    <button
                      onClick={() =>
                        setEditingId(null)
                      }
                      className="text-[12px] text-text-muted hover:text-text-base px-3 py-1.5 rounded-lg transition"
                    >
                      {t("cancel")}
                    </button>

                    <button
                      onClick={() =>
                        handleEdit(fn.id)
                      }
                      disabled={loading}
                      className="text-[12px] bg-accent/20 text-accent-light hover:bg-accent/30 px-3 py-1.5 rounded-lg transition disabled:opacity-50"
                    >
                      {t("save")}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() =>
                        startEdit(fn)
                      }
                      className="text-[12px] text-text-muted hover:text-text-base px-3 py-1.5 rounded-lg transition"
                    >
                      {t("edit")}
                    </button>

                    <button
                      onClick={() =>
                        handleDelete(
                          fn.id
                        )
                      }
                      disabled={loading}
                      className="text-[12px] text-red-400/70 hover:text-red-400 px-3 py-1.5 rounded-lg transition disabled:opacity-50"
                    >
                      {t("delete")}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const input =
  "w-full bg-bg-base border border-accent/15 rounded-xl px-3 py-2 text-[13px] placeholder:text-text-muted outline-none focus:border-accent/40 transition"