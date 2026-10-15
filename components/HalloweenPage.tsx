"use client"

import { createContext, useContext, type ReactNode } from "react"
import { useTheme } from "@/components/ThemeContext"
import styles from "./HalloweenPage.module.css"
import { HalloweenWeb } from "./HalloweenFrame"
import { MotionConfig } from "framer-motion"

const HalloweenScope = createContext(false)

// Portals retain React context, but need the scoped color variables on their DOM root.
export function HalloweenSurface({ children, className = "" }: { children: ReactNode; className?: string }) {
  const enabled = useContext(HalloweenScope)
  return <div className={`${enabled ? styles.night : ""} ${className}`}>{children}</div>
}

export function HalloweenCorner({ className = "" }: { className?: string }) {
  const { halloweenEnabled } = useTheme()
  if (!halloweenEnabled) return null
  return <div aria-hidden="true" data-halloween-art className={`${styles.corner} ${className}`}>
    <HalloweenWeb />
    <img src="/seasonal/halloween/pumpkin.webp" alt="" width={160} height={160} draggable={false} className={styles.cornerPumpkin} />
  </div>
}

export default function HalloweenPage({ children, className = "", home = false, decorated = false }: {
  children: ReactNode; className?: string; home?: boolean; decorated?: boolean
}) {
  const { halloweenEnabled } = useTheme()
  return <div className={`${styles.page} ${halloweenEnabled ? styles.night : ""} ${className}`} data-seasonal-theme={halloweenEnabled ? "halloween" : "normal"}>
    {halloweenEnabled && <div aria-hidden="true" className={styles.sky}>
      {!home && <img src="/seasonal/halloween/moon.webp" alt="" width={256} height={256} className={styles.moon} />}
      <svg viewBox="0 0 64 32" className={styles.bat}><path d="M32 12C25 1 12 2 1 9C8 11 9 17 10 23C15 18 20 20 24 27L32 30L40 27C44 20 49 18 54 23C55 17 56 11 63 9C52 2 39 1 32 12Z" /></svg>
      <svg viewBox="0 0 64 32" className={`${styles.bat} ${styles.secondBat}`}><path d="M32 12C25 1 12 2 1 9C8 11 9 17 10 23C15 18 20 20 24 27L32 30L40 27C44 20 49 18 54 23C55 17 56 11 63 9C52 2 39 1 32 12Z" /></svg>
    </div>}
    {decorated && <HalloweenCorner className={styles.pageCorner} />}
    <HalloweenScope.Provider value={halloweenEnabled}>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </HalloweenScope.Provider>
  </div>
}
