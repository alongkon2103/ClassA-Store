"use client"

import { useState, useRef } from "react"
import { getImageUrl } from "@/lib/getImageUrl"

type ProductImage = { id: string; url: string; alt_text?: string }

export default function ImageManager({ productId, images }: { productId: string; images: ProductImage[] }) {
  const [list, setList]       = useState(images)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver]   = useState(false)
  const [alt, setAlt]         = useState("")
  const [preview, setPreview] = useState<string | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith("image/")) return
    setPendingFile(file)
    setPreview(URL.createObjectURL(file))
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }

  const handleUpload = async () => {
    if (!pendingFile) return
    setUploading(true)

    // 1. upload file → get url
    const fd = new FormData()
    fd.append("file", pendingFile)
    const uploadRes = await fetch("/api/admin/upload", { method: "POST", body: fd })
    const { url, error } = await uploadRes.json()

    if (!uploadRes.ok) { alert(error); setUploading(false); return }

    // 2. save to product_images
    const res = await fetch(`/api/admin/products/${productId}/images`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, alt_text: alt, sort_order: list.length }),
    })
    const data = await res.json()
    setUploading(false)
    if (!res.ok) { alert(data.error); return }

    setList((l) => [...l, data])
    setPendingFile(null)
    setPreview(null)
    setAlt("")
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete image?")) return
    await fetch(`/api/admin/products/${productId}/images/${id}`, { method: "DELETE" })
    setList((l) => l.filter((img) => img.id !== id))
  }

  const handleCancel = () => {
    setPendingFile(null)
    setPreview(null)
    setAlt("")
  }

  return (
    <div className="space-y-5">
      {/* Existing Images */}
      {list.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {list.map((img, i) => (
            <div key={img.id} className="relative group rounded-xl overflow-hidden aspect-video bg-bg-base">
              <img src={getImageUrl(img.url)} alt={img.alt_text} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center gap-2">
                <span className="text-[11px] text-white/60 font-mono">{img.url}</span>
                <span className="text-[10px] text-white/40">#{i + 1}</span>
                <button onClick={() => handleDelete(img.id)}
                  className="text-[12px] px-3 py-1 rounded-lg bg-red-500/80 text-white hover:bg-red-500 transition">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Area */}
      {!preview ? (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition ${
            dragOver
              ? "border-accent bg-accent/5"
              : "border-accent/20 hover:border-accent/40 hover:bg-white/[0.02]"
          }`}
        >
          {/* <p className="text-3xl mb-3">🖼️</p> */}
          <p className="text-[13px] text-text-muted">
            Drag & drop image here, or <span className="text-accent-light underline">browse</span>
          </p>
          <p className="text-[11px] text-text-muted/60 mt-1">JPG, PNG, WEBP, GIF</p>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f) }}
          />
        </div>
      ) : (
        /* Preview + Confirm */
        <div className="bg-bg-base border border-accent/15 rounded-2xl p-4 space-y-3">
          <p className="text-[13px] font-medium">Preview</p>

          <div className="aspect-video rounded-xl overflow-hidden bg-bg-card">
            <img src={preview} className="w-full h-full object-cover" />
          </div>

          <div>
            <label className="block text-[11px] text-text-muted uppercase tracking-wide mb-1.5">
              Alt Text (optional)
            </label>
            <input
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              placeholder="e.g. Roblox Live Map screenshot"
              className="w-full bg-bg-card border border-accent/15 rounded-xl px-3 py-2.5 text-[13px] placeholder:text-text-muted outline-none focus:border-accent/40 transition"
            />
          </div>

          <div className="flex gap-2">
            <button onClick={handleCancel}
              className="flex-1 py-2.5 rounded-xl border border-white/10 text-text-muted text-[13px] hover:text-text-base transition">
              Cancel
            </button>
            <button onClick={handleUpload} disabled={uploading}
              className="flex-1 py-2.5 rounded-xl bg-accent text-white text-[13px] font-medium hover:opacity-90 transition disabled:opacity-50">
              {uploading ? "Uploading..." : "Upload & Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}