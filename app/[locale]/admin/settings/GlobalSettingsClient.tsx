"use client"

import { useState } from "react"
import { useLocale } from "next-intl"

type Props = {
  initialConfigs?: Record<string, string>
}

const inputClass = "w-full rounded-xl border border-border-soft bg-bg-base px-3 py-2.5 text-sm text-text-base outline-none transition focus:border-accent focus-visible:ring-1 focus-visible:ring-accent"
const switchClass = "relative h-6 w-12 shrink-0 rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-card disabled:opacity-50"

export default function GlobalSettingsClient({ initialConfigs = {} }: Props) {
  const th = useLocale() === "th"
  const [downloadUrl, setDownloadUrl] = useState(initialConfigs.app_download_url ?? "")
  const [downloadName, setDownloadName] = useState(initialConfigs.app_download_name ?? "")
  const [trialDuration, setTrialDuration] = useState(initialConfigs.free_trial_duration ?? "1")
  const [isTrialEnabled, setIsTrialEnabled] = useState(initialConfigs.free_trial_enabled !== "false")
  const [isTrialPremium, setIsTrialPremium] = useState(initialConfigs.free_trial_is_premium === "true")
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ error: boolean; message: string } | null>(null)

  const handleSaveConfig = async () => {
    setSaving(true)
    setResult(null)
    try {
      const res = await fetch("/api/admin/settings/configs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          configs: {
            free_trial_duration: trialDuration,
            free_trial_enabled: String(isTrialEnabled),
            free_trial_is_premium: String(isTrialPremium),
            app_download_url: downloadUrl,
            app_download_name: downloadName,
          },
        }),
      })
      const data = await res.json().catch(() => ({}))
      setResult(res.ok
        ? { error: false, message: th ? "บันทึกการตั้งค่าทั่วไปแล้ว" : "General settings saved." }
        : { error: true, message: data.error || (th ? "บันทึกไม่สำเร็จ สิ่งที่แก้ไขยังอยู่ในหน้านี้ กรุณาลองอีกครั้ง" : "Save failed. Your edits are still here. Please try again.") })
    } catch {
      setResult({ error: true, message: th ? "เชื่อมต่อไม่สำเร็จ สิ่งที่แก้ไขยังอยู่ในหน้านี้ กรุณาลองอีกครั้ง" : "Could not connect. Your edits are still here. Please try again." })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border-soft bg-bg-card p-4 sm:p-6">
        <h2 className="text-xl font-bold text-text-base">{th ? "ทดลองใช้ฟรี" : "Free trial"}</h2>
        <div className="mt-5 flex items-center justify-between gap-4 rounded-xl bg-[var(--color-surface-tint)] p-4">
          <div>
            <p id="trial-enabled-label" className="text-sm font-semibold text-text-base">{th ? "เปิดระบบทดลองใช้ฟรี" : "Enable free trials"}</p>
            <p className="mt-1 text-xs leading-relaxed text-text-muted">{th ? "อนุญาตให้ผู้ใช้เปิดใช้งานสิทธิ์ทดลองใช้ฟรีประจำวัน" : "Allow users to activate a one-time daily free trial."}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={isTrialEnabled}
            aria-labelledby="trial-enabled-label"
            onClick={() => setIsTrialEnabled(!isTrialEnabled)}
            className={`${switchClass} ${isTrialEnabled ? "bg-accent" : "bg-[var(--color-surface-tint-strong)]"}`}
          >
            <span className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform ${isTrialEnabled ? "translate-x-6" : "translate-x-0"}`} />
          </button>
        </div>
        <fieldset disabled={!isTrialEnabled} className="mt-5 space-y-5 disabled:opacity-50">
          <legend className="sr-only">{th ? "รายละเอียดการทดลองใช้ฟรี" : "Free trial details"}</legend>
          <div className="max-w-sm">
            <label htmlFor="trial-duration" className="mb-2 block text-sm font-medium text-text-base">{th ? "ระยะเวลาทดลอง (วัน)" : "Trial duration (days)"}</label>
            <input id="trial-duration" type="number" value={trialDuration} onChange={event => setTrialDuration(event.target.value)} className={inputClass} />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p id="trial-premium-label" className="text-sm font-semibold text-text-base">{th ? "ให้สิทธิ์ Premium ระหว่างทดลอง" : "Premium access during the trial"}</p>
              <p className="mt-1 text-xs text-text-muted">{th ? "ผู้ใช้จะใช้ฟีเจอร์ Premium ได้ตลอดช่วงทดลองใช้ฟรี" : "Users receive Premium features for the trial period."}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isTrialPremium}
              aria-labelledby="trial-premium-label"
              onClick={() => setIsTrialPremium(!isTrialPremium)}
              className={`${switchClass} ${isTrialPremium ? "bg-accent" : "bg-[var(--color-surface-tint-strong)]"}`}
            >
              <span className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform ${isTrialPremium ? "translate-x-6" : "translate-x-0"}`} />
            </button>
          </div>
        </fieldset>
      </section>

      <section className="space-y-5 rounded-2xl border border-border-soft bg-bg-card p-4 sm:p-6">
        <div>
          <h2 className="text-xl font-bold text-text-base">{th ? "ดาวน์โหลดโปรแกรม" : "Program download"}</h2>
          <p className="mt-2 text-sm text-text-muted">{th ? "ข้อมูลที่แสดงในส่วนดาวน์โหลดบนหน้าตั้งค่าของผู้ใช้" : "Details shown in the download area of the user's settings page."}</p>
        </div>
        <div>
          <label htmlFor="download-name" className="mb-2 block text-sm font-medium text-text-base">{th ? "ชื่อโปรแกรม" : "Program name"}</label>
          <input id="download-name" value={downloadName} onChange={event => setDownloadName(event.target.value)} className={inputClass} placeholder="A Class Store Live" />
        </div>
        <div>
          <label htmlFor="download-url" className="mb-2 block text-sm font-medium text-text-base">{th ? "ลิงก์ดาวน์โหลด" : "Download URL"}</label>
          <input id="download-url" type="url" value={downloadUrl} onChange={event => setDownloadUrl(event.target.value)} className={inputClass} placeholder="https://example.com/download/app.exe" />
        </div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>{result && <p role={result.error ? "alert" : "status"} className={`text-sm ${result.error ? "text-red-500" : "text-text-base"}`}>{result.message}</p>}</div>
        <button
          type="button"
          onClick={handleSaveConfig}
          disabled={saving}
          className="min-h-11 shrink-0 rounded-xl bg-accent px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {saving ? (th ? "กำลังบันทึก..." : "Saving...") : (th ? "บันทึกการตั้งค่าทั่วไป" : "Save general settings")}
        </button>
      </div>
    </div>
  )
}
