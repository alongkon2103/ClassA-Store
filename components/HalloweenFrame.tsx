"use client"

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react"
import { useTheme } from "@/components/ThemeContext"
import styles from "./HalloweenFrame.module.css"

export default function HalloweenFrame({ children, index = 0, featured = false }: {
  children: ReactNode; index?: number; featured?: boolean
}) {
  const { halloweenEnabled } = useTheme()
  const [flying, setFlying] = useState(false)
  const flightTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (flightTimer.current !== null) clearTimeout(flightTimer.current) }, [])
  const startFlight = (event: PointerEvent<HTMLDivElement>) => {
    if (!halloweenEnabled || featured || event.pointerType !== "mouse" || flightTimer.current !== null) return
    if (!window.matchMedia("(min-width: 768px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)").matches) return
    setFlying(true)
    // Keep the flight alive after pointer leave; one timer also prevents rapid re-entry from restarting it.
    flightTimer.current = setTimeout(() => { setFlying(false); flightTimer.current = null }, 1000)
  }
  const decoration = featured ? "featured" : index === 0 ? "ghost" : index === 3 ? "web" : index === 7 ? "pumpkin" : "none"
  return <div onPointerEnter={startFlight} className={`${styles.frame} ${halloweenEnabled ? styles.seasonal : ""} ${featured ? styles.featured : ""}`} data-halloween={halloweenEnabled ? decoration : undefined}>
    {children}
    {halloweenEnabled && <div aria-hidden="true" className={styles.decorations}>
      {(decoration === "ghost" || featured) && <img src="/seasonal/halloween/ghost.webp" alt="" width={256} height={202} draggable={false} className={styles.ghost} />}
      {(decoration === "pumpkin" || featured) && <img src="/seasonal/halloween/pumpkin.webp" alt="" width={160} height={160} draggable={false} className={styles.pumpkin} />}
    </div>}
    {halloweenEnabled && !featured && flying && <div aria-hidden="true" className={styles.swarm}>
      {[0, 1, 2].map((bat) => <span key={bat} className={styles.swarmBat}>
        <img src="/seasonal/halloween/bat.webp" alt="" width={160} height={119} draggable={false} />
      </span>)}
    </div>}
  </div>
}

export function HalloweenWeb({ right = false }: { right?: boolean }) {
  const { halloweenEnabled } = useTheme()
  if (!halloweenEnabled) return null
  return <svg aria-hidden="true" viewBox="0 0 64 64" fill="none" className={`${styles.web} ${right ? styles.webRight : ""}`}>
    <path d="M0 0H64M0 0V64M0 0L60 24M0 0L45 45M0 0L24 60M16 0Q13 4 15 6Q10 7 11 11Q7 10 6 15Q4 13 0 16M32 0Q26 8 30 12Q20 14 22 22Q14 20 12 30Q8 26 0 32M48 0Q39 12 45 18Q30 21 33 33Q21 30 18 45Q12 39 0 48M64 0Q52 16 60 24Q40 28 45 45Q28 40 24 60Q16 52 0 64" />
  </svg>
}

export function HalloweenHeroScene() {
  const { halloweenEnabled } = useTheme()
  if (!halloweenEnabled) return null
  return <div aria-hidden="true" className={styles.heroScene}>
    <img src="/seasonal/halloween/moon.webp" alt="" width={256} height={256} className={styles.moon} />
    <img src="/seasonal/halloween/ghost.webp" alt="" width={256} height={202} className={styles.ghost} />
    <img src="/seasonal/halloween/pumpkin.webp" alt="" width={160} height={160} className={styles.pumpkin} />
    <img src="/seasonal/halloween/bat.webp" alt="" width={160} height={119} className={styles.bat} />
    <HalloweenWeb />
  </div>
}

export function HalloweenFooterScene() {
  const { halloweenEnabled } = useTheme()
  if (!halloweenEnabled) return null
  return <div aria-hidden="true" className={styles.footerScene}>
    <img src="/seasonal/halloween/pumpkin.webp" alt="" width={160} height={160} />
    <img src="/seasonal/halloween/ghost.webp" alt="" width={256} height={202} />
    <img src="/seasonal/halloween/pumpkin.webp" alt="" width={160} height={160} />
  </div>
}
