"use client"

import { useState, useRef } from "react"

function formatBytes(bytes: number) {
  if (bytes < 1024)        return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function PresetManager({ productId, presets }: { productId: string; presets: any[] }) {
  const [list, setList]       = useState(presets)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver]   = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (file: File) => setPendingFile(file)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }

  const handleUpload = async () => {
    if (!pendingFile) return
    setUploading(true)

    const fd = new FormData()
    fd.append("file", pendingFile)
    fd.append("type", "preset")
    const uploadRes = await fetch("/api/admin/upload", { method: "POST", body: fd })
    const { url, filename, filesize, error } = await uploadRes.json()

    if (!uploadRes.ok) { alert(error); setUploading(false); return }

    const res = await fetch(`/api/admin/products/${productId}/presets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, filename: pendingFile.name, filesize: pendingFile.size, sort_order: list.length }),
    })
    const data = await res.json()
    setUploading(false)
    if (!res.ok) { alert(data.error); return }

    setList((l) => [...l, data])
    setPendingFile(null)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete preset file?")) return
    await fetch(`/api/admin/products/${productId}/presets/${id}`, { method: "DELETE" })
    setList((l) => l.filter((p) => p.id !== id))
  }

  return (
    <div className="space-y-5">
      <p className="text-[13px] text-text-muted">
        Preset files available after purchase — Supports ZIP, JSON, and other formats (Max 100MB).
      </p>

      {/* List */}
      {list.length > 0 && (
        <div className="space-y-2">
          {list.map((preset) => (
            <div key={preset.id}
              className="flex items-center justify-between bg-bg-base border border-accent/10 rounded-xl px-4 py-3">
              <div className="flex items-center gap-3">
                {/* <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center text-lg">
                  📦
                </div> */}
                <div>
                  <p className="text-[13px] font-medium">{preset.filename}</p>
                  <p className="text-[11px] text-text-muted">
                    {preset.filesize ? formatBytes(preset.filesize) : "—"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a href={preset.url} target="_blank" rel="noreferrer"
                  className="text-[12px] px-3 py-1.5 rounded-lg border border-accent/20 text-accent-light hover:bg-accent/10 transition">
                  Preview
                </a>
                <button onClick={() => handleDelete(preset.id)}
                  className="text-[12px] px-3 py-1.5 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 transition">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload */}
      {!pendingFile ? (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition ${
            dragOver ? "border-accent bg-accent/5" : "border-accent/20 hover:border-accent/40 hover:bg-white/[0.02]"
          }`}
        >
          {/* <p className="text-3xl mb-3">📦</p> */}
          <p className="text-[13px] text-text-muted">
            Drag & drop preset file, or <span className="text-accent-light underline">browse</span>
          </p>
          <p className="text-[11px] text-text-muted/60 mt-1">ZIP, JSON, any file (max 100MB)</p>
          <input ref={inputRef} type="file" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f) }} />
        </div>
      ) : (
        <div className="bg-bg-base border border-accent/15 rounded-2xl p-4 space-y-3">
          <p className="text-[13px] font-medium">Ready to upload</p>
          <div className="flex items-center gap-3 bg-bg-card rounded-xl px-4 py-3">
            <span className="text-2xl">📦</span>
            <div>
              <p className="text-[13px] font-medium">{pendingFile.name}</p>
              <p className="text-[11px] text-text-muted">{formatBytes(pendingFile.size)}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setPendingFile(null)}
              className="flex-1 py-2.5 rounded-xl border border-white/10 text-text-muted text-[13px] hover:text-text-base transition">
              Cancel
            </button>
            <button onClick={handleUpload} disabled={uploading}
              className="flex-1 py-2.5 rounded-xl bg-accent text-white text-[13px] font-medium hover:opacity-90 transition disabled:opacity-50">
              {uploading ? "Uploading..." : "Upload Preset"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}