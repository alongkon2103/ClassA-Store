"use client"

import React, { useState } from "react"
import { useRouter } from "@/i18n/routing"
import { format } from "date-fns"
import { useTranslations, useLocale } from "next-intl"
import { th, enUS } from "date-fns/locale"
import { motion, AnimatePresence } from "framer-motion"
import { Megaphone, Plus, Edit2, Trash2, Eye, EyeOff, Save, X, Image as ImageIcon, Upload, RefreshCcw } from "lucide-react"
import TiptapEditor from "@/components/admin/TiptapEditor"
import { getImageUrl } from "@/lib/getImageUrl"

interface AnnouncementItem {
  id: string
  title: string
  content: string
  imageUrl: string | null
  isActive: boolean
  createdAt: string | Date
  users?: { username: string | null } | null
}

export default function AnnouncementsClient({ announcements }: { announcements: AnnouncementItem[] }) {
  const t = useTranslations("Admin")
  const locale = useLocale()
  const dateLocale = locale === "th" ? th : enUS
  const router = useRouter()
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  
  // Upload State
  const [preview, setPreview] = useState<string | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  
  // Form State
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    imageUrl: "",
    isActive: true
  })

  const stripHtml = (html: string) => {
    return html.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ');
  }

  const handleEdit = (ann: AnnouncementItem) => {
    setEditingId(ann.id)
    setFormData({
      title: ann.title,
      content: ann.content,
      imageUrl: ann.imageUrl || "",
      isActive: ann.isActive
    })
    setPreview(ann.imageUrl ? getImageUrl(ann.imageUrl) : null)
    setIsModalOpen(true)
  }

  const handleClose = () => {
    setIsModalOpen(false)
    setEditingId(null)
    setFormData({ title: "", content: "", imageUrl: "", isActive: true })
    setPreview(null)
    setPendingFile(null)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith("image/")) {
      setPendingFile(file)
      setPreview(URL.createObjectURL(file))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      let finalImageUrl = formData.imageUrl

      // 1. If there's a pending file, upload it first
      if (pendingFile) {
        const fd = new FormData()
        fd.append("file", pendingFile)
        const uploadRes = await fetch("/api/admin/upload", { method: "POST", body: fd })
        const uploadData = await uploadRes.json()
        if (uploadRes.ok) {
          finalImageUrl = uploadData.url
        } else {
          throw new Error(uploadData.error || "Upload failed")
        }
      }

      const url = editingId 
        ? `/api/admin/desktop/announcements/${editingId}`
        : `/api/admin/desktop/announcements`
      
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, imageUrl: finalImageUrl })
      })

      if (res.ok) {
        handleClose()
        router.refresh()
      }
    } catch (error: unknown) {
      alert((error as Error)?.message || "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t("delete_confirm"))) return
    await fetch(`/api/admin/desktop/announcements/${id}`, { method: "DELETE" })
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-bold flex items-center gap-3">
            <Megaphone className="text-purple-400" />
            {t("announcements")}
          </h1>
          <p className="text-text-muted text-[13px] mt-0.5">Manage news and updates for the desktop application.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-accent hover:bg-accent-light text-white px-5 py-2.5 rounded-xl text-[13px] font-bold transition-all shadow-lg shadow-accent/20 flex items-center gap-2"
        >
          <Plus size={18} />
          Create New
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {announcements.length === 0 && (
          <div className="col-span-full py-20 text-center bg-bg-card border border-accent/10 rounded-3xl">
            <Megaphone size={48} className="mx-auto text-text-muted/20 mb-4" />
            <p className="text-text-muted">No announcements yet. Create your first one!</p>
          </div>
        )}
        {announcements.map((ann) => (
          <motion.div
            layout
            key={ann.id}
            className={`bg-bg-card border border-accent/10 rounded-3xl overflow-hidden flex flex-col group transition-all hover:border-accent/30 ${!ann.isActive && 'opacity-60 grayscale-[0.5]'}`}
          >
            {ann.imageUrl ? (
              <div className="h-40 overflow-hidden relative">
                <img src={getImageUrl(ann.imageUrl)} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                <div className="absolute top-3 right-3 flex gap-2">
                   {!ann.isActive && <span className="bg-black/60 backdrop-blur-md text-white text-[9px] font-bold px-2 py-1 rounded-lg uppercase tracking-wider">Hidden</span>}
                </div>
              </div>
            ) : (
              <div className="h-40 bg-accent/5 flex items-center justify-center text-accent/20">
                <ImageIcon size={48} />
              </div>
            )}
            
            <div className="p-5 flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
                  {format(new Date(ann.createdAt), "dd MMM yyyy", { locale: dateLocale })}
                </span>
                <div className="flex gap-1">
                   <button onClick={() => handleEdit(ann)} className="p-2 text-text-muted hover:text-accent transition-colors"><Edit2 size={16} /></button>
                   <button onClick={() => handleDelete(ann.id)} className="p-2 text-text-muted hover:text-red-400 transition-colors"><Trash2 size={16} /></button>
                </div>
              </div>
              <h3 className="font-bold text-[16px] mb-2 line-clamp-1 group-hover:text-accent-light transition-colors">{ann.title}</h3>
              <p className="text-[12px] text-text-muted line-clamp-3 mb-4 flex-1">{stripHtml(ann.content)}</p>
              
              <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center text-[8px] font-bold text-accent-light">
                    {ann.users?.username?.[0].toUpperCase() || "A"}
                  </div>
                  <span className="text-[11px] text-text-muted font-medium">{ann.users?.username || "Admin"}</span>
                </div>
                {ann.isActive ? <Eye size={14} className="text-green-400" /> : <EyeOff size={14} className="text-text-muted" />}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 overflow-y-auto py-10">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleClose}
              className="fixed inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-4xl bg-bg-card border border-accent/20 rounded-[2.5rem] p-8 shadow-2xl overflow-hidden my-auto"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-accent" />
              
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-[22px] font-bold">{editingId ? 'Edit Announcement' : 'New Announcement'}</h2>
                  <p className="text-text-muted text-[12px] mt-0.5">Fill in the details below to broadcast news.</p>
                </div>
                <button onClick={handleClose} className="p-2 text-text-muted hover:text-white transition-colors"><X size={20} /></button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-6">
                  {/* Top Section: Title & Image */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-1 space-y-1.5">
                      <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider ml-1">Cover Image</label>
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="relative h-48 w-full bg-white/[0.03] border-2 border-dashed border-accent/15 rounded-2xl overflow-hidden group cursor-pointer hover:border-accent/40 transition-all"
                      >
                        {preview ? (
                          <>
                            <img src={preview} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <RefreshCcw className="text-white" size={24} />
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full text-text-muted">
                            <Upload size={32} className="mb-2 opacity-20" />
                            <span className="text-[11px] font-bold uppercase tracking-wider">Upload Image</span>
                          </div>
                        )}
                        <input 
                          type="file" 
                          ref={fileInputRef} 
                          className="hidden" 
                          accept="image/*" 
                          onChange={handleFileSelect}
                        />
                      </div>
                    </div>
                    
                    <div className="md:col-span-2 space-y-6">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider ml-1">Title</label>
                        <input
                          required
                          value={formData.title}
                          onChange={e => setFormData({ ...formData, title: e.target.value })}
                          className="w-full bg-white/[0.03] border border-accent/15 rounded-2xl px-5 py-3.5 text-[16px] font-bold outline-none focus:border-accent/40 transition-all"
                          placeholder="E.g. Server Maintenance or New Update v1.2.0"
                        />
                      </div>

                      <div className="flex items-center gap-3 p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.isActive ? 'bg-accent' : 'bg-white/10'}`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                        <div>
                          <p className="text-[12px] font-bold text-text-base uppercase">Visibility</p>
                          <p className="text-[11px] text-text-muted">Show this announcement on the desktop program</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Section: Content Editor */}
                  <div className="space-y-1.5 flex flex-col">
                    <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider ml-1">Announcement Content</label>
                    <div className="min-h-[300px]">
                      <TiptapEditor 
                        content={formData.content} 
                        onChange={content => setFormData({ ...formData, content })} 
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-8 py-4 rounded-2xl border border-white/10 text-[14px] font-bold hover:bg-white/5 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-accent hover:bg-accent-light text-white px-8 py-4 rounded-2xl text-[14px] font-black transition-all shadow-xl shadow-accent/30 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? (
                      <RefreshCcw size={18} className="animate-spin" />
                    ) : (
                      <>
                        <Save size={18} />
                        Save Announcement
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

