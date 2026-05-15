"use client"

import { useState, useEffect } from "react"
import { useTranslations } from "next-intl"

export default function GlobalSettingsClient() {
  const t = useTranslations("Admin")
  const [resetting, setResetting] = useState(false)
  const [trialDuration, setTrialDuration] = useState<string>("10")
  const [isTrialEnabled, setIsTrialEnabled] = useState<boolean>(true)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchConfigs()
  }, [])

  const fetchConfigs = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/settings/configs")
      const data = await res.json()
      if (data.free_trial_duration) {
        setTrialDuration(data.free_trial_duration)
      }
      if (data.free_trial_enabled !== undefined) {
        setIsTrialEnabled(data.free_trial_enabled !== "false")
      }
    } catch (error) {
      console.error("Failed to fetch configs", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveConfig = async () => {
    setSaving(true)
    try {
      // Save both duration and enabled status
      await Promise.all([
        fetch("/api/admin/settings/configs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: "free_trial_duration", value: trialDuration })
        }),
        fetch("/api/admin/settings/configs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: "free_trial_enabled", value: String(isTrialEnabled) })
        })
      ])
      alert(t("save_config_success") || "Settings saved successfully")
    } catch (error) {
      alert("An error occurred")
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    if (!confirm("Are you sure you want to CLEAR ALL gift-to-function mappings? This cannot be undone.")) return
    
    setResetting(true)
    try {
      const res = await fetch("/api/admin/settings/reset-mappings", { method: "DELETE" })
      const data = await res.json()
      if (res.ok) {
        alert("All mappings have been cleared successfully.")
      } else {
        alert(data.error || "Failed to clear mappings")
      }
    } catch (error) {
      alert("An error occurred while clearing mappings.")
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="space-y-10">
      {/* Trial Settings */}
      <section>
        <h2 className="text-[20px] font-bold text-text-base mb-4 flex items-center gap-2">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light">
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
          </svg>
          {t("trial_duration_settings")}
        </h2>
        
        <div className="bg-bg-card border border-white/5 rounded-2xl p-6">
          <div className="flex flex-col gap-6">
            {/* Toggle Switch */}
            <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
              <div>
                <p className="text-[14px] font-bold text-text-base">Enable Free Trial System</p>
                <p className="text-[12px] text-text-muted mt-0.5">Allow users to activate a one-time daily free trial</p>
              </div>
              <button 
                onClick={() => setIsTrialEnabled(!isTrialEnabled)}
                className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none ${isTrialEnabled ? 'bg-accent' : 'bg-white/10'}`}
              >
                <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${isTrialEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>

            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className={`flex-1 space-y-2 transition-opacity duration-200 ${!isTrialEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
                <label className="text-[13px] text-text-muted font-medium">{t("trial_duration_label")}</label>
                <div className="relative max-w-[200px]">
                  <input
                    type="number"
                    value={trialDuration}
                    onChange={e => setTrialDuration(e.target.value)}
                    className="w-full bg-bg-base border border-white/10 rounded-xl px-4 py-2.5 text-[14px] outline-none focus:border-accent/40 transition"
                    placeholder="10"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[12px] text-text-muted">min</span>
                </div>
              </div>
              <button
                onClick={handleSaveConfig}
                disabled={saving || loading}
                className="px-8 py-2.5 rounded-xl bg-accent hover:opacity-90 text-white font-bold text-[14px] transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : t("save")}
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="pt-10 border-t border-white/10">
        <h2 className="text-[20px] font-bold text-red-500 mb-4 flex items-center gap-2">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          Danger Zone
        </h2>
        
        <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-text-base">Reset Global Mappings</p>
              <p className="text-[13px] text-text-muted mt-1 max-w-md">
                This will permanently delete all custom gift-to-function mappings for ALL users. 
                Users will be reverted to using default mappings.
              </p>
            </div>
            <button
              onClick={handleReset}
              disabled={resetting}
              className="px-6 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-[14px] transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap"
            >
              {resetting ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </>
              ) : (
                "Clear All Mappings"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
