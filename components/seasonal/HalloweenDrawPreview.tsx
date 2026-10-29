"use client"

import { useEffect, useId, useRef, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { ChevronRight, Gamepad2, RotateCcw, Sparkles, X } from "lucide-react"
import { useLocale } from "next-intl"
import { Link } from "@/i18n/routing"
import { getImageUrl } from "@/lib/getImageUrl"
import { HALLOWEEN_GAME_SLUGS, pickHalloweenPrize, type HalloweenGame, type HalloweenPrize } from "@/lib/halloweenEvent"
import { halloweenErrorText, useHalloweenEvent } from "./useHalloweenEvent"
import HalloweenClaim from "./HalloweenClaim"
import styles from "./HalloweenDrawPreview.module.css"

type Phase = "idle" | "opening" | "suspense" | "revealed"
const games = ["AC Universe", "AC Hyper Run", "AC Jump EVO", "AC Pig Panic", "AC Slash"]
const sparks = Array.from({ length: 16 }, (_, i) => ({ x: Math.cos(i * 2.4) * (80 + i * 8), y: Math.sin(i * 2.4) * (80 + i * 8) - 20 }))

// Only the separate preview uses local outcomes. Home requests its durable reward from the server.
export default function HalloweenDrawPreview({ embedded = false, live = false, demoGames = [] }: { embedded?: boolean; live?: boolean; demoGames?: HalloweenGame[] }) {
  const th = useLocale() === "th"
  const reduced = useReducedMotion()
  const [phase, setPhase] = useState<Phase>("idle")
  const [prize, setPrize] = useState<HalloweenPrize | null>(null)
  const event = useHalloweenEvent(live)
  const [error, setError] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const resultTitle = useRef<HTMLHeadingElement>(null)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const pending = useRef(false)
  const generation = useRef(0)
  const titleId = useId()
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = [] }
  useEffect(() => () => { generation.current++; timers.current.forEach(clearTimeout) }, [])
  useEffect(() => {
    if (!embedded || !isOpen) return
    const el = dialog.current
    const focus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const overflow = document.body.style.overflow
    el?.showModal()
    document.body.style.overflow = "hidden"
    return () => { el?.close(); document.body.style.overflow = overflow; if (focus?.isConnected) focus.focus() }
  }, [embedded, isOpen])

  const canDraw = !live || (!!event.state?.signedIn && event.state.available && event.state.phase === "active" && !event.state.draw)
  const open = async () => {
    if (!canDraw) return
    if (pending.current) return
    pending.current = true
    const current = ++generation.current
    clearTimers()
    setError(null)
    setPhase("opening")
    if (embedded) setIsOpen(true)
    if (!reduced) timers.current.push(setTimeout(() => setPhase("suspense"), 2400))
    try {
      const catalog = demoGames.length === 5 ? demoGames : HALLOWEEN_GAME_SLUGS.map((slug, i) => ({ id: slug, slug, name_th: games[i], name_en: games[i], type: "roblox_whitelist", imageUrl: null }))
      const [next] = await Promise.all([
        live ? event.request("", {}).then(draw => draw.prize) : Promise.resolve(pickHalloweenPrize(catalog, Math.floor(Math.random() * 1500))),
        new Promise<void>(resolve => timers.current.push(setTimeout(resolve, reduced ? 150 : 3500))),
      ])
      if (current !== generation.current) return
      setPrize(next); setPhase("revealed")
    } catch (e) {
      if (current !== generation.current) return
      clearTimers(); setPhase("idle"); setError(halloweenErrorText(e instanceof Error ? e.message : "unavailable", th))
      if (live) void event.refresh()
    } finally { if (current === generation.current) pending.current = false }
  }
  const close = () => { generation.current++; clearTimers(); pending.current = false; setIsOpen(false); setPhase("idle"); setPrize(null); setError(null) }
  const show = () => {
    if (!live) { void open(); return }
    setError(null)
    setPrize(event.state?.draw?.prize ?? null)
    setPhase(event.state?.draw ? "revealed" : "idle")
    setIsOpen(true)
    // Recover a reward whose response was lost or whose draw completed while closed.
    void event.refresh()
  }
  useEffect(() => {
    if (live && isOpen && !pending.current && event.state?.draw) { setPrize(event.state.draw.prize); setPhase("revealed") }
  }, [live, isOpen, event.state?.draw])
  const busy = phase === "opening" || phase === "suspense"
  const revealed = phase === "revealed"
  const suspense = phase === "suspense"
  const sample = live ? (th ? "สุ่มฟรี 1 ครั้งต่อบัญชีตลอดกิจกรรม" : "One free draw per account for this event") : (th ? "ตัวอย่าง UI · ยังไม่แจกของจริง" : "UI preview · no real rewards")
  const timing = th ? "30 ต.ค. 00:01 – 1 พ.ย. 00:01 (เวลาไทย)" : "30 Oct 00:01 – 1 Nov 00:01 (GMT+7)"
  const action = !event.state ? (th ? "กำลังโหลด…" : "Loading…") : !event.state.signedIn ? (th ? "เข้าสู่ระบบเพื่อร่วมกิจกรรม" : "Sign in to join") : event.state.draw ? (th ? "ดูรางวัลของฉัน" : "View my prize") : event.state.phase === "upcoming" ? (th ? "ยังไม่เริ่มกิจกรรม" : "Not started yet") : event.state.phase === "ended" ? (th ? "กิจกรรมสิ้นสุดแล้ว" : "Event ended") : !event.state.available ? (th ? "กิจกรรมไม่พร้อมใช้งาน" : "Event unavailable") : (th ? "เปิดฟักทองฟรี" : "Open your free pumpkin")
  const idleHint = live && event.state?.phase === "upcoming" ? (th ? "เจอกัน 30 ต.ค. เวลา 00:01 น. ♡" : "See you on 30 Oct at 00:01 (GMT+7) ♡") : live && event.state?.phase === "ended" ? (th ? "กิจกรรมสิ้นสุดแล้ว ขอบคุณที่ร่วมสนุก ♡" : "The event has ended. Thanks for joining ♡") : (th ? "แตะน้องฟักทอง แล้วมาลุ้นด้วยกัน" : "Tap the pumpkin. Let the magic happen.")

  const scene = <div className={styles.scene} data-phase={phase}>
    <span className={styles.kicker}>A LITTLE HALLOWEEN MAGIC</span>
    <h2 id={titleId} className={styles.title}>{revealed ? (th ? "เซอร์ไพรส์! ของขวัญของคุณ" : "A little surprise for you!") : (th ? "มีอะไรซ่อนอยู่ข้างในนะ?" : "What’s hiding inside?")}</h2>
    <p className={styles.subtitle}>{th ? "ฟักทองหนึ่งใบ ความสุขหนึ่งเซอร์ไพรส์" : "One little pumpkin. One happy surprise."}</p>
    <div className={styles.stage}>
      <div className={styles.aura} aria-hidden="true" /><div className={styles.ring} aria-hidden="true" />
      <div className={styles.specks} aria-hidden="true">{Array.from({ length: 10 }, (_, i) => <i key={i} style={{ left: `${14 + (i * 31 % 73)}%`, top: `${12 + (i * 23 % 76)}%`, animationDelay: `${i * -.6}s` }} />)}</div>
      {!revealed && <motion.img className={styles.friend} src="/seasonal/halloween/ghost.webp" alt="" width={72} height={60} animate={reduced ? {} : { y: [0, -7, 0], rotate: [4, -4, 4] }} transition={{ duration: 4, repeat: Infinity }} />}
      <AnimatePresence mode="wait">
        {!revealed ? <motion.button key="pumpkin" type="button" className={styles.pumpkin} onClick={open} disabled={busy || !canDraw} aria-label={th ? "เปิดฟักทอง" : "Open pumpkin"}
          initial={{ opacity: 0, scale: .9 }} animate={reduced ? { opacity: 1, scale: 1 } : suspense ? { opacity: 1, scale: 1.12, rotate: 0, y: -12 } : phase === "opening" ? { opacity: 1, scale: [1, 1.02, .99, 1.04, 1], rotate: [0, -4, 4, -5, 5, -3, 3, 0], y: [0, -4, 0] } : { opacity: 1, scale: 1, rotate: 0, y: [0, -6, 0] }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 1.4, y: -12, filter: "brightness(2.2) blur(5px)" }}
          transition={{ duration: reduced ? .12 : phase === "opening" ? 2.4 : suspense ? .85 : 3.5, repeat: phase === "idle" && !reduced ? Infinity : 0, ease: "easeInOut", opacity: { duration: .2 }, scale: { duration: suspense ? .85 : .45 } }}>
          <img src="/seasonal/halloween/draw-pumpkin.webp" alt="ฟักทองอวบหน้ายิ้ม" width={400} height={400} draggable={false} />
        </motion.button> : <motion.div key="result" className={`${styles.result} ${prize?.kind === "game" ? styles.game : ""}`} initial={reduced ? { opacity: 0 } : { opacity: 0, y: 28, scale: .8 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} transition={{ type: "spring", stiffness: 150, damping: 18 }} onAnimationComplete={() => resultTitle.current?.focus({ preventScroll: true })}>
          {!reduced && <div className={styles.confetti} aria-hidden="true">{sparks.map((spark, i) => <motion.i key={i} style={{ background: ["#ffd398", "#e7c4ff", "#fff4cf"][i % 3] }} initial={{ x: 0, y: 0, opacity: 0 }} animate={{ x: spark.x, y: spark.y, opacity: [0, 1, 0], rotate: i * 37 }} transition={{ duration: 1.8, delay: i * .015 }} />)}</div>}
          <span className={styles.resultSpark} aria-hidden="true">✧</span>
          {prize?.kind === "game" && prize.product.imageUrl ? <img className={styles.gameCover} src={getImageUrl(prize.product.imageUrl)} alt={th ? prize.product.name_th : prize.product.name_en} width={300} height={169} /> : <div className={styles.medal} aria-hidden="true">{prize?.kind === "points" ? "AC" : <Gamepad2 size={54} strokeWidth={1.4} />}</div>}
          <p className={styles.resultLabel}>{th ? "ของขวัญในฟักทองใบนี้คือ" : "Inside your pumpkin"}</p>
          <h3 ref={resultTitle} tabIndex={-1}>{prize?.kind === "points" ? prize.amount.toLocaleString() : prize?.kind === "game" ? th ? prize.product.name_th : prize.product.name_en : ""}</h3>
          <p className={styles.unit}>{prize?.kind === "points" ? "AC POINTS" : th ? `เล่นฟรี ${prize?.days} วัน` : `${prize?.days} days of play`}</p>
        </motion.div>}
      </AnimatePresence>
      {suspense && !reduced && <motion.div className={styles.flash} aria-hidden="true" initial={{ opacity: 0, scale: .5 }} animate={{ opacity: [0, .7, 0], scale: [1, 1.8, 2] }} transition={{ duration: 1.3 }} />}
    </div>
    <p className={styles.status} role="status" aria-live="polite">{revealed ? (th ? "เย่! น้องฟักทองเลือกให้แล้ว ♡" : "A little treat, chosen just for you ♡") : suspense ? (th ? "ชู่ว… กำลังจะรู้แล้ว" : "Shhh… here it comes") : busy ? (th ? "กุ๊กกู๋… กำลังหาของขวัญให้คุณ" : "Finding a little treat for you…") : idleHint}</p>
    {live && revealed && event.state?.draw ? <HalloweenClaim draw={event.state.draw} th={th} onClaim={async ign => { await event.request("/claim", { draw_id: event.state!.draw!.id, ign }) }} /> : live && !event.state?.signedIn && event.state ? <Link href="/login?callbackUrl=%2F" className={styles.openButton}>{action}</Link> : <button type="button" className={styles.openButton} onClick={open} disabled={busy || !canDraw}>{revealed ? <RotateCcw size={16} /> : <Sparkles size={17} />}{busy ? (th ? "รอเซอร์ไพรส์แป๊บนึง…" : "A surprise is on its way…") : live ? action : revealed ? (th ? "ลองลุ้นอีกครั้ง" : "Try again") : (th ? "เปิดฟักทอง" : "Open pumpkin")}{!busy && <ChevronRight size={16} />}</button>}
    {(error || (live && event.error)) && <p role="alert" className={styles.error}>{error ?? halloweenErrorText(event.error!, th)}<button type="button" onClick={() => void event.refresh()}>{th ? "โหลดใหม่" : "Reload"}</button></p>}
    <p className={styles.previewNote}>{sample}</p>
    {live && <><p className={styles.eventTime}>{timing}</p><details className={styles.prizePool}><summary>{th ? "มีอะไรอยู่ในฟักทองบ้าง?" : "What’s inside the pumpkin?"}</summary><p>{th ? "AC Points 2,000 / 3,000 / 5,000 (รวม 60%) · เกม 1 หรือ 3 วัน (รวม 40%)" : "2,000 / 3,000 / 5,000 AC Points (60% total) · 1 or 3 game days (40% total)"}</p><div>{event.state?.games.map(game => <figure key={game.id}>{game.imageUrl && <img src={getImageUrl(game.imageUrl)} alt="" width={100} height={60} loading="lazy" />}<figcaption>{th ? game.name_th : game.name_en}</figcaption></figure>)}</div><p>{th ? "แต้มแต่ละจำนวน 20% · แต่ละเกมและจำนวนวัน 4% · ไม่ต้องซื้อสินค้าก็ร่วมได้" : "Each point amount: 20%. Each game/day prize: 4%. No purchase required."}</p></details></>}
  </div>

  if (!embedded) return <main className={styles.previewPage}>{scene}</main>
  return <>
    <div className="page-container mt-5 mb-2">
      <section className={styles.banner} aria-label={th ? "กิจกรรมฟักทองแจกโชค" : "Halloween surprise"}>
        <div className={styles.bannerCopy}><span className={styles.bannerKicker}>HALLOWEEN LITTLE SURPRISE</span><h2>{th ? "กุ๊กกู๋… มีของขวัญมาฝาก" : "A little Halloween treat for you"}</h2><p>{th ? "ลุ้น AC Points หรือวันเล่นเกม ในฟักทองใบนี้" : "Discover AC Points or game days inside."}{live && <span className={styles.bannerTime}>{timing}</span>}</p><button type="button" onClick={show} className={styles.bannerButton}>{live ? event.state?.phase === "active" || event.state?.draw ? action : th ? "ดูกิจกรรม" : "View event" : th ? "ลองเปิดฟักทอง" : "Try the pumpkin"}<ChevronRight size={15} /></button><span className={styles.bannerNote}>{sample}</span></div>
        <button type="button" className={styles.bannerPumpkin} onClick={show} aria-label={th ? "ดูกิจกรรมฟักทอง" : "View pumpkin event"}><img src="/seasonal/halloween/draw-pumpkin.webp" alt="" width={220} height={220} /><span aria-hidden="true">✧</span></button>
        <img className={styles.bannerGhost} src="/seasonal/halloween/ghost.webp" width={60} height={50} alt="" aria-hidden="true" />
      </section>
    </div>
    {isOpen && <dialog ref={dialog} className={styles.dialog} aria-labelledby={titleId} onCancel={e => { e.preventDefault(); close() }} onClick={e => { if (e.target === e.currentTarget) close() }}><button type="button" onClick={close} className={styles.close} aria-label={th ? "ปิด" : "Close"}><X size={19} /><span className="sr-only">{th ? "ปิด" : "Close"}</span></button>{scene}</dialog>}
  </>
}
