"use client"

import React, { useEffect } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import Link from "@tiptap/extension-link"
import Image from "@tiptap/extension-image"
import Color from "@tiptap/extension-color"
import { TextStyle } from "@tiptap/extension-text-style"
import Highlight from "@tiptap/extension-highlight"
import TextAlign from "@tiptap/extension-text-align"
import Youtube from "@tiptap/extension-youtube"
import { Table } from "@tiptap/extension-table"
import { TableRow } from "@tiptap/extension-table-row"
import { TableCell } from "@tiptap/extension-table-cell"
import { TableHeader } from "@tiptap/extension-table-header"

import { 
  Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, 
  Quote, Undo, Redo, Code, Link as LinkIcon, Image as ImageIcon,
  Heading1, Heading2, Heading3, AlignLeft, AlignCenter, AlignRight,
  Highlighter, Palette, Play as YoutubeIcon, Table as TableIcon,
  Eraser
} from "lucide-react"

interface TiptapEditorProps {
  content: string
  onChange: (content: string) => void
}

const MenuBar = ({ editor }: { editor: any }) => {
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
      
      {/* Colors & Highlight */}
      <div className="flex gap-1 pl-1 border-l border-accent/10 ml-1">
        <button type="button" onClick={() => editor.chain().focus().toggleHighlight().run()} className={`p-2 rounded-lg hover:bg-accent/10 transition ${editor.isActive("highlight") ? "text-yellow-400 bg-yellow-400/10" : "text-text-muted"}`} title="Highlight"><Highlighter size={16} /></button>
        <div className="relative flex items-center px-1" title="Text Color">
          <Palette size={14} className="absolute left-2 text-text-muted pointer-events-none" />
          <input 
              type="color" 
              onInput={e => editor.chain().focus().setColor((e.target as HTMLInputElement).value).run()} 
              value={editor.getAttributes('textStyle').color || '#ffffff'}
              className="w-10 h-8 p-1 pl-6 bg-transparent border-0 cursor-pointer"
          />
        </div>
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
      TextStyle,
      Color,
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
        class: "prose prose-invert max-w-none focus:outline-none min-h-[350px] px-5 py-4 text-[14px]",
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
      <style jsx global>{`
        .prose ul { list-style-type: disc; padding-left: 1.5em; margin: 1em 0; }
        .prose ol { list-style-type: decimal; padding-left: 1.5em; margin: 1em 0; }
        .prose h1 { font-size: 1.8em; font-weight: 800; margin: 1.2em 0 0.6em; color: white; }
        .prose h2 { font-size: 1.5em; font-weight: 700; margin: 1.1em 0 0.5em; color: white; }
        .prose p { margin: 0.8em 0; line-height: 1.6; }
        .prose table { border-collapse: collapse; table-layout: fixed; width: 100%; margin: 0; overflow: hidden; }
        .prose table td, .prose table th { border: 2px solid rgba(255,255,255,0.1); box-sizing: border-box; min-width: 1em; padding: 3px 5px; position: relative; vertical-align: top; }
        .prose table th { background-color: rgba(255,255,255,0.05); font-weight: bold; text-align: left; }
        .prose .text-left { text-align: left; }
        .prose .text-center { text-align: center; }
        .prose .text-right { text-align: right; }
      `}</style>
    </div>
  )
}
