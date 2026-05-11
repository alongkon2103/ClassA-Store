"use client"

import { useRef, useState } from "react"
import Image from "next/image"
import { useTranslations } from "next-intl"

type GiftItem = {
  id: string
  url: string
  filename: string
  sort_order?: number
}

type Props = {
  productId: string
  gifts: GiftItem[]
}

export default function GiftManager({
  productId,
  gifts,
}: Props) {
  const t = useTranslations("AdminGiftImages")

  const [list, setList] = useState<GiftItem[]>(gifts)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)

  // ─────────────────────────────────────────────
  // Select File
  // ─────────────────────────────────────────────
  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert(t("imagesOnly"))
      return
    }

    if (preview) {
      URL.revokeObjectURL(preview)
    }

    setPendingFile(file)
    setPreview(URL.createObjectURL(file))
  }

  // ─────────────────────────────────────────────
  // Drag & Drop
  // ─────────────────────────────────────────────
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)

    const file = e.dataTransfer.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  // ─────────────────────────────────────────────
  // Reset Preview
  // ─────────────────────────────────────────────
  const resetPreview = () => {
    if (preview) {
      URL.revokeObjectURL(preview)
    }

    setPendingFile(null)
    setPreview(null)

    if (inputRef.current) {
      inputRef.current.value = ""
    }
  }

  // ─────────────────────────────────────────────
  // Upload
  // ─────────────────────────────────────────────
  const handleUpload = async () => {
    if (!pendingFile) return

    try {
      setUploading(true)

      // Upload file
      const fd = new FormData()
      fd.append("file", pendingFile)
      fd.append("type", "gift")

      const uploadRes = await fetch("/api/admin/upload", {
        method: "POST",
        body: fd,
      })

      const uploadData = await uploadRes.json()

      if (!uploadRes.ok) {
        alert(uploadData.error || t("uploadFailed"))
        console.log(uploadData.error);
        return
      }

      // Save to database
      const res = await fetch(
        `/api/admin/products/${productId}/gifts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: uploadData.url,
            filename: uploadData.filename,
            sort_order: list.length,
          }),
        }
      )

      const data = await res.json()

      if (!res.ok) {
        alert(data.error || t("saveFailed"))
        return
      }

      setList((prev) => [...prev, data])
      resetPreview()
    } catch (error) {
      console.error("Upload error:", error)
      alert(t("uploadFailed"))
    } finally {
      setUploading(false)
    }
  }

  // ─────────────────────────────────────────────
  // Delete
  // ─────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (!confirm(t("deleteConfirm"))) {
      return
    }

    try {
      setDeletingId(id)

      const res = await fetch(
        `/api/admin/products/${productId}/gifts/${id}`,
        {
          method: "DELETE",
        }
      )

      if (!res.ok) {
        alert(t("deleteFailed"))
        return
      }

      setList((prev) =>
        prev.filter((gift) => gift.id !== id)
      )
    } catch (error) {
      console.error("Delete error:", error)
      alert(t("deleteFailed"))
    } finally {
      setDeletingId(null)
    }
  }

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-[18px] font-semibold">
          {t("title")}
        </h2>
        <p className="text-[13px] text-text-muted mt-1">
          {t("subtitle")}
        </p>
      </div>

      {/* Existing Images */}
      {list.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {list.map((gift, index) => (
            <div
              key={gift.id}
              className="relative group rounded-2xl overflow-hidden aspect-video bg-bg-base border border-accent/10"
            >
              <Image
                src={gift.url}
                alt={gift.filename}
                fill
                className="object-cover"
                unoptimized
              />

              <div className="absolute inset-0 bg-black/65 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center gap-2 p-3">
                <span className="text-[10px] text-white/60">
                  #{index + 1}
                </span>

                <span className="text-[11px] text-white/70 font-mono text-center break-all line-clamp-2">
                  {gift.filename}
                </span>

                <button
                  onClick={() => handleDelete(gift.id)}
                  disabled={deletingId === gift.id}
                  className="text-[12px] px-3 py-1 rounded-lg bg-red-500/85 text-white hover:bg-red-500 transition disabled:opacity-50"
                >
                  {deletingId === gift.id
                    ? t("deleting")
                    : t("delete")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {list.length === 0 && !preview && (
        <div className="text-center py-10 bg-bg-card border border-accent/10 rounded-2xl text-text-muted text-[13px]">
          {t("empty")}
        </div>
      )}

      {/* Upload Area */}
      {!preview ? (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition ${
            dragOver
              ? "border-accent bg-accent/5"
              : "border-accent/20 hover:border-accent/40 hover:bg-white/[0.02]"
          }`}
        >
          <p className="text-[13px] text-text-muted">
            {t("dragDrop")}{" "}
            <span className="text-accent-light underline">
              {t("browse")}
            </span>
          </p>

          <p className="text-[11px] text-text-muted/60 mt-1">
            JPG, PNG, WEBP (max 5MB)
          </p>

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) {
                handleFileSelect(file)
              }
            }}
          />
        </div>
      ) : (
        <div className="bg-bg-card border border-accent/15 rounded-2xl p-4 space-y-4">
          <p className="text-[13px] font-medium">
            {t("preview")}
          </p>

          <div className="relative aspect-video rounded-xl overflow-hidden bg-bg-base">
            <Image
              src={preview}
              alt="Preview"
              fill
              className="object-cover"
              unoptimized
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={resetPreview}
              className="flex-1 py-2.5 rounded-xl border border-white/10 text-text-muted text-[13px] hover:text-text-base transition"
            >
              {t("cancel")}
            </button>

            <button
              onClick={handleUpload}
              disabled={uploading}
              className="flex-1 py-2.5 rounded-xl bg-accent text-white text-[13px] font-medium hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {uploading && (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}

              {uploading
                ? t("uploading")
                : t("upload")}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}