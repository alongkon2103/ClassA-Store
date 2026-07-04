"use client"

import React, { useEffect } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import type { Editor } from "@tiptap/core"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import Link from "@tiptap/extension-link"
import Image from "@tiptap/extension-image"
// Color + TextStyle removed on purpose — text color must follow site theme,
// admins shouldn't be able to override it (the saved color would render the
// same in both light and dark, breaking one of them).
import Highlight from "@tiptap/extension-highlight"
import TextAlign from "@tiptap/extension-text-align"
import Youtube from "@tiptap/extension-youtube"
import { Table } from "@tiptap/extension-table"
import { TableRow } from "@tiptap/extension-table-row"
import { TableCell } from "@tiptap/extension-table-cell"
import { TableHeader } from "@tiptap/extension-table-header"

import {
  Bold, Italic, Underline as UnderlineIcon, List, ListOrdered,
  Undo, Redo, Link as LinkIcon, Image as ImageIcon,
  Heading1, Heading2, AlignLeft, AlignCenter, AlignRight,
  Highlighter, Play as YoutubeIcon, Table as TableIcon,
  Eraser
} from "lucide-react"

interface TiptapEditorProps {
  content: string
  onChange: (content: string) => void
}

const MenuBar = ({ editor }: { editor: Editor | null }) => {
  if (!editor) return null

  const addLink = () => {
    const url = window.prompt("URL")
    if (url) editor.chain().focus().setLink({ href: url }).run()
  }

  const addImage = () => {
    const url = window.prompt("Image URL")
    if (url) editor.chain().focus().setImage({ src: url }).run()
  }

  const addYoutube = () => {
    const url = window.prompt("YouTube URL")
    if (url) editor.commands.setYoutubeVideo({ src: url })
  }

  return (
    <div className="flex flex-wrap gap-1 p-2 border-b border-accent/15 bg-white/[0.02]">
      {/* History */}
      <div className="flex gap-1 pr-1 border-r border-accent/10 mr-1">
        <button type="button" onClick={() => editor.chain().focus().undo().run()} className="p-2 rounded-lg hover:bg-accent/10 transition text-text-muted" title="Undo"><Undo size={16} /></button>
        <button type="button" onClick={() => editor.chain().focus().redo().run()} className="p-2 rounded-lg hover:bg-accent/10 transition text-text-muted" title="Redo"><Redo size={16} /></button>
      </div>

      {/* Text Style */}
      <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={`p-2 rounded-lg hover:bg-accent/10 transition ${editor.isActive("bold") ? "text-accent-light bg-accent/10" : "text-text-muted"}`} title="Bold"><Bold size={16} /></button>
      <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={`p-2 rounded-lg hover:bg-accent/10 transition ${editor.isActive("italic") ? "text-accent-light bg-accent/10" : "text-text-muted"}`} title="Italic"><Italic size={16} /></button>
      <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} className={`p-2 rounded-lg hover:bg-accent/10 transition ${editor.isActive("underline") ? "text-accent-light bg-accent/10" : "text-text-muted"}`} title="Underline"><UnderlineIcon size={16} /></button>
      
      {/* Highlight — background tint only. Text color picker intentionally
          omitted: text colors must follow the site theme. */}
      <div className="flex gap-1 pl-1 border-l border-accent/10 ml-1">
        <button type="button" onClick={() => editor.chain().focus().toggleHighlight().run()} className={`p-2 rounded-lg hover:bg-accent/10 transition ${editor.isActive("highlight") ? "text-yellow-400 bg-yellow-400/10" : "text-text-muted"}`} title="Highlight"><Highlighter size={16} /></button>
      </div>

      {/* Headings */}
      <div className="flex gap-1 pl-1 border-l border-accent/10 ml-1">
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={`p-2 rounded-lg hover:bg-accent/10 transition ${editor.isActive("heading", { level: 1 }) ? "text-accent-light bg-accent/10" : "text-text-muted"}`} title="Heading 1"><Heading1 size={16} /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={`p-2 rounded-lg hover:bg-accent/10 transition ${editor.isActive("heading", { level: 2 }) ? "text-accent-light bg-accent/10" : "text-text-muted"}`} title="Heading 2"><Heading2 size={16} /></button>
      </div>

      {/* Alignment */}
      <div className="flex gap-1 pl-1 border-l border-accent/10 ml-1">
        <button type="button" onClick={() => editor.chain().focus().setTextAlign('left').run()} className={`p-2 rounded-lg hover:bg-accent/10 transition ${editor.isActive({ textAlign: 'left' }) ? "text-accent-light bg-accent/10" : "text-text-muted"}`} title="Align Left"><AlignLeft size={16} /></button>
        <button type="button" onClick={() => editor.chain().focus().setTextAlign('center').run()} className={`p-2 rounded-lg hover:bg-accent/10 transition ${editor.isActive({ textAlign: 'center' }) ? "text-accent-light bg-accent/10" : "text-text-muted"}`} title="Align Center"><AlignCenter size={16} /></button>
        <button type="button" onClick={() => editor.chain().focus().setTextAlign('right').run()} className={`p-2 rounded-lg hover:bg-accent/10 transition ${editor.isActive({ textAlign: 'right' }) ? "text-accent-light bg-accent/10" : "text-text-muted"}`} title="Align Right"><AlignRight size={16} /></button>
      </div>

      {/* Lists */}
      <div className="flex gap-1 pl-1 border-l border-accent/10 ml-1">
        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={`p-2 rounded-lg hover:bg-accent/10 transition ${editor.isActive("bulletList") ? "text-accent-light bg-accent/10" : "text-text-muted"}`} title="Bullet List"><List size={16} /></button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={`p-2 rounded-lg hover:bg-accent/10 transition ${editor.isActive("orderedList") ? "text-accent-light bg-accent/10" : "text-text-muted"}`} title="Ordered List"><ListOrdered size={16} /></button>
      </div>

      {/* Media & Table */}
      <div className="flex gap-1 pl-1 border-l border-accent/10 ml-1">
        <button type="button" onClick={addLink} className={`p-2 rounded-lg hover:bg-accent/10 transition ${editor.isActive("link") ? "text-accent-light bg-accent/10" : "text-text-muted"}`} title="Add Link"><LinkIcon size={16} /></button>
        <button type="button" onClick={addImage} className="p-2 rounded-lg hover:bg-accent/10 transition text-text-muted" title="Add Image (URL)"><ImageIcon size={16} /></button>
        <button type="button" onClick={addYoutube} className="p-2 rounded-lg hover:bg-accent/10 transition text-red-500" title="Add YouTube Video"><YoutubeIcon size={16} /></button>
        <button type="button" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} className="p-2 rounded-lg hover:bg-accent/10 transition text-text-muted" title="Insert Table"><TableIcon size={16} /></button>
      </div>

      {/* Clear Formatting */}
      <div className="flex gap-1 pl-1 border-l border-accent/10 ml-1">
        <button type="button" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} className="p-2 rounded-lg hover:bg-red-400/10 transition text-text-muted hover:text-red-400" title="Clear Formatting"><Eraser size={16} /></button>
      </div>
    </div>
  )
}

export default function TiptapEditor({ content, onChange }: TiptapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-accent-light underline underline-offset-4 cursor-pointer' },
      }),
      Image.configure({
        HTMLAttributes: { class: 'max-w-full h-auto rounded-xl border border-accent/10 my-4' },
      }),
      Youtube.configure({ width: 480, height: 320 }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content,
    editorProps: {
      attributes: {
        // No prose-invert — colors come from theme vars in the global style
        // block below so the editor reads correctly in both dark and light.
        class: "prose max-w-none focus:outline-none min-h-[350px] px-5 py-4 text-[14px] text-text-base",
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
  })

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content)
    }
  }, [content, editor])

  return (
    <div className="w-full bg-white/[0.03] border border-accent/15 rounded-2xl overflow-hidden focus-within:border-accent/40 transition-all shadow-inner">
      <MenuBar editor={editor} />
      <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
        <EditorContent editor={editor} />
      </div>
      {/* .prose theme styles live in app/globals.css so the same rules apply to
          rendered Tiptap output elsewhere (e.g. ProductModal description). */}
    </div>
  )
}
