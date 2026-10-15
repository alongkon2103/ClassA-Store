"use client"

import React, { createContext, useContext, useEffect, useState } from "react"

type Theme = "dark" | "light"

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
  halloweenEnabled: boolean
  toggleHalloween: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark")
  const [halloweenEnabled, setHalloweenEnabled] = useState(true)

  useEffect(() => {
    try {
      const saved = localStorage.getItem("theme") as Theme | null
      if (saved === "light" || saved === "dark") {
        setTheme(saved)
        document.documentElement.setAttribute("data-theme", saved)
      }
      // ถ้าไม่มี saved ก็ปล่อย dark (ซึ่งเป็น default ของ :root CSS แล้ว)
    } catch (e) {}
    try {
      const enabled = localStorage.getItem("halloween-theme") !== "off"
      setHalloweenEnabled(enabled)
      document.documentElement.dataset.seasonalPreference = enabled ? "on" : "off"
    } catch { /* Storage may be disabled. */ }
  }, [])
  // ✅ [] หมายความว่า run ครั้งเดียวตอน mount เท่านั้น
  // เปลี่ยนภาษาไม่ทำให้ effect นี้ run ซ้ำ

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark"
    setTheme(newTheme)
    try { localStorage.setItem("theme", newTheme) } catch { /* Keep the switch usable without storage. */ }
    document.documentElement.setAttribute("data-theme", newTheme)
  }

  const toggleHalloween = () => {
    const enabled = !halloweenEnabled
    setHalloweenEnabled(enabled)
    document.documentElement.dataset.seasonalPreference = enabled ? "on" : "off"
    try { localStorage.setItem("halloween-theme", enabled ? "on" : "off") } catch { /* Keep the switch usable without storage. */ }
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, halloweenEnabled, toggleHalloween }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return context
}
