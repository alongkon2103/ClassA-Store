"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import TiptapEditor from "@/components/admin/TiptapEditor"

type Props = {
  initialRulesTh?: string
  initialRulesEn?: string
}

export default function RulesSettingsClient({
  initialRulesTh = "",
  initialRulesEn = "",
}: Props) {
  const t = useTranslations("Admin")
  const [rulesTh, setRulesTh] = useState(initialRulesTh)
  const [rulesEn, setRulesEn] = useState(initialRulesEn)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/admin/settings/configs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          configs: {
            rules_th: rulesTh,
            rules_en: rulesEn,
          },
        }),
      })
      if (res.ok) {
        alert(t("save_config_success") || "Settings saved successfully")
      } else {
        const data = await res.json().catch(() => ({}))
        alert(data.error || "Failed to save settings")
      }
    } catch {
      alert("An error occurred")
    } finally {
      setSaving(false)
    }
  }

  return (
    <section>
      <h2 className="text-[20px] font-bold text-text-base mb-4 flex items-center gap-2">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="8" y1="13" x2="16" y2="13" />
          <line x1="8" y1="17" x2="16" y2="17" />
        </svg>
        {t("rules_settings_title")}
      </h2>

      <div className="bg-bg-card border border-white/5 rounded-2xl p-6 space-y-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[13px] text-text-muted font-medium">
              {t("rules_th_label")}
            </label>
            <span className="text-[11px] text-accent-light bg-accent/5 px-2 py-0.5 rounded-md border border-accent/10">
              TH
            </span>
          </div>
          <TiptapEditor content={rulesTh} onChange={setRulesTh} />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[13px] text-text-muted font-medium">
              {t("rules_en_label")}
            </label>
            <span className="text-[11px] text-accent-light bg-accent/5 px-2 py-0.5 rounded-md border border-accent/10">
              EN
            </span>
          </div>
          <TiptapEditor content={rulesEn} onChange={setRulesEn} />
        </div>

        <p className="text-[11px] text-text-muted italic">
          {t("rules_hint")}
        </p>

        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-8 py-2.5 rounded-xl bg-accent hover:opacity-90 text-white font-bold text-[14px] transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              t("save")
            )}
          </button>
        </div>
      </div>
    </section>
  )
}
