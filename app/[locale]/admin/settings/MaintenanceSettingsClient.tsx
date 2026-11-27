"use client"

import { useState } from "react"
import { useLocale } from "next-intl"

export default function MaintenanceSettingsClient() {
  const th = useLocale() === "th"
  const [resetting, setResetting] = useState(false)
  const [result, setResult] = useState<{ error: boolean; message: string } | null>(null)

  const handleReset = async () => {
    if (!confirm(th
      ? "ต้องการลบการจับคู่ของขวัญกับฟังก์ชันที่กำหนดเองของผู้ใช้ทุกคนหรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้"
      : "Are you sure you want to CLEAR ALL gift-to-function mappings? This cannot be undone.")) return

    setResetting(true)
    setResult(null)
    try {
      const res = await fetch("/api/admin/settings/reset-mappings", { method: "DELETE" })
      const data = await res.json().catch(() => ({}))
      setResult(res.ok
        ? { error: false, message: th ? "ลบการจับคู่ทั้งหมดแล้ว" : "All mappings have been cleared successfully." }
        : { error: true, message: data.error || (th ? "ลบการจับคู่ไม่สำเร็จ กรุณาลองอีกครั้ง" : "Failed to clear mappings. Please try again.") })
    } catch {
      setResult({ error: true, message: th ? "เกิดข้อผิดพลาดขณะลบการจับคู่ กรุณาลองอีกครั้ง" : "An error occurred while clearing mappings. Please try again." })
    } finally {
      setResetting(false)
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-text-base">{th ? "บำรุงรักษาระบบ" : "System maintenance"}</h2>
        <p className="mt-2 text-sm text-text-muted">{th ? "คำสั่งในหมวดนี้มีผลกับผู้ใช้ทุกคน และไม่ใช่การบันทึกการตั้งค่าร้าน" : "Actions here affect all users and are separate from saving store settings."}</p>
      </div>
      <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4 sm:p-6">
        <h3 className="font-semibold text-text-base">{th ? "ล้างการจับคู่ของขวัญกับฟังก์ชันทั้งหมด" : "Reset global gift-to-function mappings"}</h3>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-muted">
          {th
            ? "ลบการจับคู่ที่กำหนดเองของผู้ใช้ทุกคนอย่างถาวร ผู้ใช้จะกลับไปใช้การจับคู่เริ่มต้น การดำเนินการนี้ไม่สามารถย้อนกลับได้"
            : "Permanently delete every user's custom gift-to-function mappings. Users will return to the default mappings. This cannot be undone."}
        </p>
        <button
          type="button"
          onClick={handleReset}
          disabled={resetting}
          className="mt-5 min-h-11 w-full rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 sm:w-auto"
        >
          {resetting ? (th ? "กำลังดำเนินการ..." : "Processing...") : (th ? "ล้างการจับคู่ทั้งหมด..." : "Clear all mappings...")}
        </button>
        {result && <p role={result.error ? "alert" : "status"} className={`mt-4 text-sm ${result.error ? "text-red-500" : "text-text-base"}`}>{result.message}</p>}
      </div>
    </section>
  )
}
