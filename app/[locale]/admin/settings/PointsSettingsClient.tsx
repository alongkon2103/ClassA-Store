"use client"

// ตั้งค่า AC Points (เฟส 1): เปิด/ปิด · แต้มต่อบาท · วันเริ่มนับ (ไม่ย้อนหลัง — ออเดอร์ก่อนหน้านี้ไม่ได้แต้ม)
import { useState } from "react"
import { useTranslations } from "next-intl"

type Props = { initialConfigs?: Record<string, string> }

// datetime-local ใช้เวลาท้องถิ่นของเครื่องแอดมิน — เก็บลง DB เป็น ISO (UTC)
const toLocalInput = (iso: string | undefined) => {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export default function PointsSettingsClient({ initialConfigs = {} }: Props) {
  const t = useTranslations("Admin")
  const [enabled, setEnabled] = useState(initialConfigs.points_enabled === "true")
  const [perBaht, setPerBaht] = useState(initialConfigs.points_per_baht || "10")
  const [startAt, setStartAt] = useState(toLocalInput(initialConfigs.points_start_at))
  const [saving, setSaving] = useState(false)

  const rate = Math.max(0, Number(perBaht) || 0)
  const example = Math.floor(750 * rate).toLocaleString()

  const toggle = () => {
    const next = !enabled
    setEnabled(next)
    if (next && !startAt) setStartAt(toLocalInput(new Date().toISOString())) // เปิดครั้งแรก = เริ่มนับตอนนี้
  }

  const handleSave = async () => {
    if (!Number.isFinite(Number(perBaht)) || Number(perBaht) <= 0) return alert(t("points_per_baht_invalid"))
    if (enabled && !startAt) return alert(t("points_start_required"))
    setSaving(true)
    try {
      const res = await fetch("/api/admin/settings/configs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          configs: {
            points_enabled: String(enabled),
            points_per_baht: String(Number(perBaht)),
            points_start_at: startAt ? new Date(startAt).toISOString() : "",
          },
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
          <circle cx="12" cy="12" r="9" /><path d="M14.5 9.5a2.5 2.5 0 0 0-5 0c0 2.5 5 2.5 5 5a2.5 2.5 0 0 1-5 0" /><path d="M12 6v1.5M12 16.5V18" />
        </svg>
        {t("points_settings_title")}
      </h2>

      <div className="bg-bg-card border border-white/5 rounded-2xl p-6 space-y-4">
        <div className={`p-4 rounded-xl border transition ${enabled ? "bg-white/5 border-white/10" : "bg-white/[0.02] border-white/5 opacity-80"}`}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[14px] font-bold text-text-base">{t("points_enabled_label")}</p>
              <p className="text-[12px] text-text-muted mt-0.5">{t("points_enabled_hint")}</p>
            </div>
            <button type="button" onClick={toggle} aria-label={t("points_enabled_label")}
              className={`relative w-12 h-6 rounded-full transition-colors duration-200 shrink-0 ${enabled ? "bg-accent" : "bg-white/10"}`}>
              <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${enabled ? "translate-x-6" : "translate-x-0"}`} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[13px] text-text-muted font-medium">{t("points_per_baht_label")}</label>
            <input type="number" min={1} step={1} value={perBaht} onChange={(e) => setPerBaht(e.target.value)}
              className="w-full bg-bg-base border border-white/10 rounded-xl px-4 py-2.5 text-[14px] text-text-base outline-none focus:border-accent/50" />
            <p className="text-[11px] text-text-muted">{t("points_per_baht_hint")}</p>
            <p className="text-[11px] text-accent-light">{t("points_preview_line", { points: example })}</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-[13px] text-text-muted font-medium">{t("points_start_label")}</label>
            <div className="flex gap-2">
              <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)}
                className="flex-1 bg-bg-base border border-white/10 rounded-xl px-4 py-2.5 text-[14px] text-text-base outline-none focus:border-accent/50" />
              <button type="button" onClick={() => setStartAt(toLocalInput(new Date().toISOString()))}
                className="px-3 rounded-xl border border-white/10 text-[12px] text-text-muted hover:text-text-base hover:border-white/20 transition whitespace-nowrap">
                {t("points_start_now")}
              </button>
            </div>
            <p className="text-[11px] text-text-muted">{t("points_start_hint")}</p>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button onClick={handleSave} disabled={saving}
            className="px-8 py-2.5 rounded-xl bg-accent hover:opacity-90 text-white font-bold text-[14px] transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : t("save")}
          </button>
        </div>
      </div>
    </section>
  )
}
