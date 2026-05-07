"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"

interface CopyButtonProps {
  value: string
}

export default function CopyButton({ value }: CopyButtonProps) {
  const t = useTranslations("Orders")
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    if (!value) return
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button 
      onClick={handleCopy}
      className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition whitespace-nowrap active:scale-95 ${
        copied 
          ? "bg-green-500/20 text-green-400" 
          : "bg-accent/10 hover:bg-accent text-accent-light hover:text-white"
      }`}
    >
      {copied ? t("copied") : t("copy")}
    </button>
  )
}

