"use client"

import { useState, useRef } from "react"
import Image from "next/image"
import { useTranslations } from "next-intl"

type Gift = {
  id: number
  name: string
  image_url: string | null
  diamonds: number
  is_active: boolean
  sort_order: number
}

type Props = {
  initialGifts: Gift[]
}

const EMPTY_FORM = {
  id: "",
  name: "",
  diamonds: "",
  image_url: "",
}

export default function GiftManagerAdmin({ initialGifts }: Props) {
  const t = useTranslations("AdminGifts")

  const [gifts, setGifts] = useState<Gift[]>(initialGifts)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)

  const setF = (key: keyof typeof EMPTY_FORM, value: string) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  // Upload image
  const handleUpload = async (file: File) => {
    try {
      setUploading(true)

      const fd = new FormData()
      fd.append("file", file)
      fd.append("type", "gift")

      const res = await fetch("/api/admin/uploads", {
        method: "POST",
        body: fd,
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.error || t("uploadFailed"))
        return
      }

      setF("image_url", data.url)
    } catch (error) {
      console.error("Upload error:", error)
      alert(t("uploadFailed"))
    } finally {
      setUploading(false)
    }
  }

  // Open add form
  const openAdd = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  // Open edit form
  const openEdit = (gift: Gift) => {
    setEditingId(gift.id)
    setForm({
      id: String(gift.id),
      name: gift.name,
      diamonds: String(gift.diamonds),
      image_url: gift.image_url ?? "",
    })
    setShowForm(true)
  }

  // Close form
  const closeForm = () => {
    setShowForm(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  // Save gift
  const handleSave = async () => {
    if (!form.id || !form.name.trim() || !form.diamonds) {
      alert(t("validationRequired"))
      return
    }

    try {
      setSaving(true)

      const isEdit = editingId !== null

      const url = isEdit
        ? `/api/admin/gifts/${editingId}`
        : "/api/admin/gifts"

      const method = isEdit ? "PATCH" : "POST"

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: Number(form.id),
          name: form.name.trim(),
          diamonds: Number(form.diamonds),
          image_url: form.image_url || null,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.error || t("saveFailed"))
        return
      }

      if (isEdit) {
        setGifts((prev) =>
          prev.map((g) => (g.id === editingId ? data : g))
        )
      } else {
        setGifts((prev) =>
          [...prev, data].sort((a, b) => a.id - b.id)
        )
      }

      closeForm()
    } catch (error) {
      console.error("Save error:", error)
      alert(t("saveFailed"))
    } finally {
      setSaving(false)
    }
  }

  // Toggle active
  const handleToggle = async (gift: Gift) => {
    try {
      const res = await fetch(`/api/admin/gifts/${gift.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          is_active: !gift.is_active,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.error || t("updateFailed"))
        return
      }

      setGifts((prev) =>
        prev.map((g) => (g.id === gift.id ? data : g))
      )
    } catch (error) {
      console.error("Toggle error:", error)
      alert(t("updateFailed"))
    }
  }

  // Delete gift
  const handleDelete = async (id: number) => {
    if (!confirm(t("deleteConfirm"))) {
      return
    }

    try {
      setDeletingId(id)

      const res = await fetch(`/api/admin/gifts/${id}`, {
        method: "DELETE",
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.error || t("deleteFailed"))
        return
      }

      setGifts((prev) => prev.filter((gift) => gift.id !== id))
    } catch (error) {
      console.error("Delete error:", error)
      alert(t("deleteFailed"))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold">{t("title")}</h1>
          <p className="text-[13px] text-text-muted mt-0.5">
            {t("subtitle")}
          </p>
        </div>

        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-accent/20 hover:bg-accent/30 text-accent-light text-[13px] font-medium px-4 py-2.5 rounded-xl transition"
        >
          <span className="text-[16px] leading-none">+</span>
          {t("addGift")}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-bg-card border border-accent/15 rounded-2xl p-5 space-y-4">
          <p className="text-[12px] text-text-muted uppercase tracking-wide font-medium">
            {editingId !== null ? t("editGift") : t("newGift")}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* ID */}
            <div>
              <label className="block text-[11px] text-text-muted mb-1.5">
                {t("id")} <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                value={form.id}
                onChange={(e) => setF("id", e.target.value)}
                disabled={editingId !== null}
                className={`${input} disabled:opacity-50`}
              />
            </div>

            {/* Name */}
            <div>
              <label className="block text-[11px] text-text-muted mb-1.5">
                {t("name")} <span className="text-red-400">*</span>
              </label>
              <input
                value={form.name}
                onChange={(e) => setF("name", e.target.value)}
                className={input}
              />
            </div>

            {/* Diamonds */}
            <div>
              <label className="block text-[11px] text-text-muted mb-1.5">
                {t("diamonds")} <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                value={form.diamonds}
                onChange={(e) => setF("diamonds", e.target.value)}
                className={input}
              />
            </div>
          </div>

          {/* Upload */}
          <div>
            <label className="block text-[11px] text-text-muted mb-1.5">
              {t("giftImage")}
            </label>

            <div className="flex items-center gap-4">
              <div
                onClick={() => fileRef.current?.click()}
                className="w-16 h-16 rounded-xl border border-accent/15 bg-bg-base flex items-center justify-center overflow-hidden cursor-pointer hover:border-accent/40 transition"
              >
                {uploading ? (
                  <div className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                ) : form.image_url ? (
                  <Image
                    src={form.image_url}
                    alt={t("giftPreview")}
                    width={64}
                    height={64}
                    className="object-cover w-full h-full"
                    unoptimized
                  />
                ) : (
                  <span className="text-[28px]">🎁</span>
                )}
              </div>

              <div className="space-y-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleUpload(file)
                  }}
                />

                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="text-[12px] border border-accent/20 hover:border-accent/40 px-3 py-2 rounded-xl transition disabled:opacity-50"
                >
                  {uploading ? t("uploading") : t("chooseImage")}
                </button>

                {form.image_url && (
                  <p className="text-[11px] text-text-muted truncate max-w-[260px]">
                    {form.image_url}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={closeForm}
              className="px-4 py-2 rounded-xl text-text-muted hover:text-text-base"
            >
              {t("cancel")}
            </button>

            <button
              onClick={handleSave}
              disabled={saving || uploading}
              className="bg-accent text-white px-5 py-2 rounded-xl disabled:opacity-50 flex items-center gap-2"
            >
              {saving && (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              {saving
                ? t("saving")
                : editingId !== null
                ? t("save")
                : t("addGift")}
            </button>
          </div>
        </div>
      )}

      {/* Empty */}
      {gifts.length === 0 && !showForm && (
        <div className="text-center py-16 text-text-muted bg-bg-card border border-accent/10 rounded-2xl">
          {t("noGifts")}
        </div>
      )}

      {/* Gift Grid */}
      {gifts.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {gifts.map((gift) => (
            <div
              key={gift.id}
              className={`bg-bg-card border rounded-2xl p-3 flex flex-col items-center gap-2.5 ${
                gift.is_active
                  ? "border-accent/10"
                  : "border-white/5 opacity-50"
              }`}
            >
              {/* Image */}
              <div className="w-14 h-14 rounded-xl bg-bg-base border border-accent/10 flex items-center justify-center overflow-hidden">
                {gift.image_url ? (
                  <Image
                    src={gift.image_url}
                    alt={gift.name}
                    width={56}
                    height={56}
                    className="object-cover w-full h-full"
                    unoptimized
                  />
                ) : (
                  <span className="text-[28px]">🎁</span>
                )}
              </div>

              {/* Info */}
              <div className="text-center w-full">
                <p className="text-[13px] font-semibold truncate">
                  {gift.name}
                </p>
                <p className="text-[11px] text-text-muted">
                  💎 {gift.diamonds}
                </p>
                <p className="text-[10px] text-text-muted/60 font-mono">
                  ID: {gift.id}
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-1.5 w-full">
                <button
                  onClick={() => handleToggle(gift)}
                  className={`flex-1 text-[10px] py-1.5 rounded-lg border ${
                    gift.is_active
                      ? "border-accent/20 text-accent-light"
                      : "border-white/10 text-text-muted"
                  }`}
                >
                  {gift.is_active ? t("active") : t("inactive")}
                </button>

                <button
                  onClick={() => openEdit(gift)}
                  className="flex-1 text-[10px] py-1.5 rounded-lg border border-white/10"
                >
                  {t("edit")}
                </button>

                <button
                  onClick={() => handleDelete(gift.id)}
                  disabled={deletingId === gift.id}
                  className="text-[10px] px-2 py-1.5 rounded-lg border border-red-500/20 text-red-400 disabled:opacity-50"
                >
                  {deletingId === gift.id ? t("deleting") : t("delete")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const input =
  "w-full bg-bg-base border border-accent/15 rounded-xl px-4 py-2.5 text-[13px] outline-none focus:border-accent/40 transition"