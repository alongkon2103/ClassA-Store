"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"

export default function GlobalSettingsClient() {
  const t = useTranslations("Admin")
  const [resetting, setResetting] = useState(false)

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
    <div className="mt-10 pt-10 border-t border-white/10">
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
  )
}
