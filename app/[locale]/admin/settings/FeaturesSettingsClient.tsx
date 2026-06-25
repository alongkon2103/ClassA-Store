"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"

type Props = {
  initialConfigs?: Record<string, string>
}

function parseBool(v: string | undefined, fallback: boolean): boolean {
  if (v === undefined || v === null || v === "") return fallback
  return v === "true"
}

export default function FeaturesSettingsClient({ initialConfigs = {} }: Props) {
  const t = useTranslations("Admin")
  const [livegenEnabled, setLivegenEnabled] = useState(
    parseBool(initialConfigs.livegen_enabled, true),
  )
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/admin/settings/configs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          configs: { livegen_enabled: String(livegenEnabled) },
        }),
      })
      if (res.ok) alert(t("save_config_success") || "Saved")
      else alert("Failed to save")
    } catch {
      alert("Failed to save")
    } finally {
      setSaving(false)
    }
  }

  return (
    <section>
      <h2 className="text-[20px] font-bold text-text-base mb-4 flex items-center gap-2">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent-light">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
        {t("features_settings_title")}
      </h2>

      <div className="bg-bg-card border border-white/5 rounded-2xl p-6 space-y-4">
        <div
          className={`p-4 rounded-xl border transition ${
            livegenEnabled ? "bg-white/5 border-white/10" : "bg-white/[0.02] border-white/5 opacity-70"
          }`}
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[14px] font-bold text-text-base">{t("feature_livegen_title")}</p>
              <p className="text-[12px] text-text-muted mt-0.5">{t("feature_livegen_hint")}</p>
            </div>
            <button
              type="button"
              onClick={() => setLivegenEnabled((v) => !v)}
              className={`relative w-12 h-6 rounded-full transition-colors duration-200 shrink-0 ${
                livegenEnabled ? "bg-accent" : "bg-white/10"
              }`}
              aria-label="Toggle livegen"
            >
              <div
                className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
                  livegenEnabled ? "translate-x-6" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

        <div className="flex justify-end pt-2">
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
