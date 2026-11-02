"use client"

import { useState } from "react"
import { useLocale } from "next-intl"
import type { HalloweenDraw } from "@/lib/halloweenEvent"
import { getImageUrl } from "@/lib/getImageUrl"
import HalloweenClaim from "@/components/seasonal/HalloweenClaim"
import styles from "./PendingEventReward.module.css"

export default function PendingEventReward({ reward }: { reward: HalloweenDraw }) {
  const [draw, setDraw] = useState(reward)
  const th = useLocale() === "th"
  if (draw.prize.kind !== "game") return null
  const game = draw.prize.product
  const claim = async (ign: string | null) => {
    const response = await fetch("/api/events/halloween/claim", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ draw_id: draw.id, ign }),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "unavailable")
    setDraw(data.draw)
  }
  return <section className={styles.normal} aria-label={th ? "รางวัลที่ยังไม่ได้รับ" : "Unclaimed reward"}>
    <h2>{th ? "รางวัลที่ยังไม่ได้รับ" : "Unclaimed reward"}</h2>
    <p>{th ? "กิจกรรมจบแล้ว แต่คุณยังรับรางวัลที่ได้รับไว้ได้" : "The event has ended. You can still receive your saved prize."}</p>
    <div className={styles.content}>
      <div>{game.imageUrl && <img src={getImageUrl(game.imageUrl)} alt="" width={280} height={158} />}<h3>{th ? game.name_th : game.name_en}</h3><p>{th ? `เล่นฟรี ${draw.prize.days} วัน` : `${draw.prize.days} days of play`}</p></div>
      <HalloweenClaim draw={draw} th={th} onClaim={claim} />
    </div>
  </section>
}
