"use client"

import { useState, useRef, useEffect } from "react"
import Image from "next/image"
import { getImageUrl } from "@/lib/getImageUrl"
import { useTranslations } from "next-intl"

type Gift = {
    id: number
    name: string
    image_url: string | null
    diamonds: number
}

type Props = {
    gifts: Gift[]
}

type LogEntry = {
    id: string
    time: string
    uniqueId: string
    nickname: string
    tiktokRecipient: string
    giftName: string
    giftImage: string | null
    diamonds: number
    repeatCount: number
    total: number
}

function buildGiftEvent(
    username: string,
    nickname: string,
    tiktokRecipient: string,
    gift: Gift,
    count: number
) {
    return {
        uniqueId:        username,
        nickname:        nickname || username,
        tiktokRecipient: tiktokRecipient || "",
        giftName:        gift.name,
        repeatCount:     count,
        diamondCount:    gift.diamonds,
        totalDiamonds:   gift.diamonds * count,
        time:            Date.now(),
        giftId:          gift.id,
        giftPictureUrl:  gift.image_url ?? "",
        repeatEnd:       true,
        msgId:           Date.now().toString(),
    }
}

function GiftImage({ url, name, size = 32 }: { url: string | null; name: string; size?: number }) {
    if (!url) return <span className="text-xl">🎁</span>
    return (
        <Image
            src={getImageUrl(url)}
            alt={name}
            width={size}
            height={size}
            className="object-cover rounded"
            unoptimized
        />
    )
}

export default function TikTokSimulator({ gifts }: Props) {
    const t = useTranslations("TikTokSimulator")

    const [username, setUsername]               = useState("user_test")
    const [nickname, setNickname]               = useState("Test User")
    const [tiktokRecipient, setTiktokRecipient] = useState("Test Tiktok")
    const [selectedGift, setSelectedGift]       = useState<Gift>(gifts[0])
    const [giftSearch, setGiftSearch]           = useState("")
    const [repeatCount, setRepeatCount]         = useState(1)
    const [logs, setLogs]                       = useState<LogEntry[]>([])
    const [sending, setSending]                 = useState(false)
    const [autoMode, setAutoMode]               = useState(false)
    const [autoInterval, setAutoIntervalVal]    = useState(3)

    const autoRef   = useRef<NodeJS.Timeout | null>(null)
    const logEndRef = useRef<HTMLDivElement>(null)

    const filteredGifts = giftSearch.trim()
        ? gifts.filter((g) => g.name.toLowerCase().includes(giftSearch.toLowerCase()))
        : gifts

    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [logs])

    const sendGift = async (overrideGift?: Gift, overrideCount?: number) => {
        const gift  = overrideGift ?? selectedGift
        const count = overrideCount ?? repeatCount
        if (!gift) return

        setSending(true)
        const event = buildGiftEvent(username, nickname, tiktokRecipient, gift, count)

        try {
            const res = await fetch("/api/admin/tiktok-simulator/gift", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(event),
            })
            await res.json()

            setLogs((l) => [...l.slice(-99), {
                id:              Math.random().toString(36).slice(2),
                time:            new Date().toLocaleTimeString(),
                uniqueId:        event.uniqueId,
                nickname:        event.nickname,
                tiktokRecipient: event.tiktokRecipient,
                giftName:        gift.name,
                giftImage:       gift.image_url,
                diamonds:        gift.diamonds,
                repeatCount:     count,
                total:           gift.diamonds * count,
            }])
        } catch (err) {
            console.error(err)
        } finally {
            setSending(false)
        }
    }

    useEffect(() => {
        if (autoMode && gifts.length > 0) {
            autoRef.current = setInterval(() => {
                const randomGift  = gifts[Math.floor(Math.random() * gifts.length)]
                const randomCount = Math.floor(Math.random() * 10) + 1
                sendGift(randomGift, randomCount)
            }, autoInterval * 1000)
        } else {
            if (autoRef.current) clearInterval(autoRef.current)
        }
        return () => { if (autoRef.current) clearInterval(autoRef.current) }
    }, [autoMode, autoInterval, username, nickname, tiktokRecipient])

    if (gifts.length === 0) {
        return (
            <div className="text-center py-24 text-text-muted text-[13px]">
                {t("no_gifts_empty")}
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-[24px] font-bold">{t("title")}</h1>
                    <p className="text-text-muted text-[13px] mt-0.5">{t("subtitle")}</p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20">
                    <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
                    <span className="text-[12px] text-orange-400 font-medium">{t("dev_only")}</span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* LEFT */}
                <div className="space-y-4">

                    {/* Sender Info */}
                    <div className="bg-bg-card border border-accent/10 rounded-2xl p-5 space-y-3">
                        <p className="text-[13px] font-semibold">{t("sender_info")}</p>

                        <div>
                            <label className={lbl}>{t("sender_username")}</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-[13px]">@</span>
                                <input value={username} onChange={(e) => setUsername(e.target.value)}
                                    placeholder="username" className={`${inp} pl-7`} />
                            </div>
                        </div>

                        <div>
                            <label className={lbl}>{t("sender_nickname")}</label>
                            <input value={nickname} onChange={(e) => setNickname(e.target.value)}
                                placeholder="Display Name" className={inp} />
                        </div>

                        <div>
                            <label className={lbl}>{t("recipient_username")}</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-[13px]">@</span>
                                <input value={tiktokRecipient} onChange={(e) => setTiktokRecipient(e.target.value)}
                                    placeholder="live_username" className={`${inp} pl-7`} />
                            </div>
                            <p className="text-[11px] text-text-muted mt-1">{t("recipient_hint")}</p>
                        </div>
                    </div>

                    {/* Gift Selector */}
                    <div className="bg-bg-card border border-accent/10 rounded-2xl p-5 space-y-3">
                        <p className="text-[13px] font-semibold">
                            {t("select_gift")}
                            <span className="text-text-muted font-normal ml-2 text-[11px]">
                                ({t("gifts_count", { count: gifts.length })})
                            </span>
                        </p>

                        <div className="relative">
                            <input value={giftSearch} onChange={(e) => setGiftSearch(e.target.value)}
                                placeholder={t("search_gift")} className={inp} />
                            {giftSearch && (
                                <button onClick={() => setGiftSearch("")}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-base text-[18px] leading-none transition">
                                    ×
                                </button>
                            )}
                        </div>

                        <div className="grid grid-cols-3 gap-2 max-h-[280px] overflow-y-auto pr-1">
                            {filteredGifts.length === 0 && (
                                <div className="col-span-3 text-center py-6 text-text-muted text-[12px]">
                                    {t("no_gift_found", { query: giftSearch })}
                                </div>
                            )}
                            {filteredGifts.map((g) => (
                                <button key={g.id} onClick={() => setSelectedGift(g)}
                                    className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border text-center transition ${
                                        selectedGift?.id === g.id
                                            ? "border-accent bg-accent/10"
                                            : "border-white/10 hover:border-accent/30"
                                    }`}>
                                    <div className="w-8 h-8 flex items-center justify-center">
                                        <GiftImage url={g.image_url} name={g.name} size={32} />
                                    </div>
                                    <p className="text-[11px] font-medium truncate w-full text-center">{g.name}</p>
                                    <p className="text-[10px] text-accent-light">💎 {g.diamonds}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Send Options */}
                    <div className="bg-bg-card border border-accent/10 rounded-2xl p-5 space-y-3">
                        <p className="text-[13px] font-semibold">{t("send_options")}</p>
                        <div>
                            <label className={lbl}>{t("repeat_count")}</label>
                            <div className="flex items-center gap-2">
                                <input type="range" min={1} max={100} value={repeatCount}
                                    onChange={(e) => setRepeatCount(Number(e.target.value))}
                                    className="flex-1" />
                                <span className="text-[14px] font-bold text-accent-light w-8 text-right">{repeatCount}</span>
                            </div>
                            <p className="text-[11px] text-text-muted mt-1">
                                {t("total_diamonds", { count: (selectedGift?.diamonds ?? 0) * repeatCount })}
                            </p>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                            {[1, 5, 10, 25, 50, 99].map((n) => (
                                <button key={n} onClick={() => setRepeatCount(n)}
                                    className={`px-3 py-1 rounded-lg text-[12px] border transition ${
                                        repeatCount === n
                                            ? "border-accent bg-accent/15 text-accent-light"
                                            : "border-white/10 text-text-muted hover:border-accent/30"
                                    }`}>
                                    x{n}
                                </button>
                            ))}
                        </div>
                        <button onClick={() => sendGift()} disabled={sending || autoMode}
                            className="w-full py-3 rounded-xl bg-accent text-white font-semibold text-[14px] hover:opacity-90 transition disabled:opacity-40 flex items-center justify-center gap-2">
                            {sending ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    {t("sending")}
                                </>
                            ) : (
                                <>
                                    <div className="w-5 h-5 flex items-center justify-center">
                                        <GiftImage url={selectedGift?.image_url} name={selectedGift?.name ?? ""} size={20} />
                                    </div>
                                    {t("send_button", { name: selectedGift?.name, count: repeatCount })}
                                </>
                            )}
                        </button>
                    </div>

                    {/* Auto Mode */}
                    <div className="bg-bg-card border border-accent/10 rounded-2xl p-5 space-y-3">
                        <div className="flex items-center justify-between">
                            <p className="text-[13px] font-semibold">{t("auto_mode")}</p>
                            <button onClick={() => setAutoMode((v) => !v)}
                                className={`w-12 h-6 rounded-full transition-colors relative ${autoMode ? "bg-green-500" : "bg-white/10"}`}>
                                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${autoMode ? "left-7" : "left-1"}`} />
                            </button>
                        </div>
                        <p className="text-[11px] text-text-muted">{t("auto_mode_desc")}</p>
                        <div>
                            <label className={lbl}>{t("interval")}</label>
                            <div className="flex items-center gap-2">
                                <input type="range" min={1} max={10} value={autoInterval}
                                    onChange={(e) => setAutoIntervalVal(Number(e.target.value))}
                                    className="flex-1" />
                                <span className="text-[14px] font-bold text-accent-light w-6 text-right">{autoInterval}s</span>
                            </div>
                        </div>
                        {autoMode && (
                            <div className="flex items-center gap-2 text-[12px] text-green-400">
                                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                                {t("auto_running", { sec: autoInterval })}
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT — Event Log */}
                <div className="bg-bg-card border border-accent/10 rounded-2xl overflow-hidden flex flex-col" style={{ maxHeight: "700px" }}>
                    <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
                        <div>
                            <p className="text-[13px] font-semibold">{t("event_log")}</p>
                            <p className="text-[11px] text-text-muted">{t("event_log_count", { count: logs.length })}</p>
                        </div>
                        <button onClick={() => setLogs([])} className="text-[12px] text-text-muted hover:text-text-base transition">
                            {t("clear")}
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                        {logs.length === 0 && (
                            <div className="text-center py-12 text-text-muted text-[13px]">
                                {t("no_events")}
                            </div>
                        )}
                        {logs.map((log) => (
                            <div key={log.id} className="flex items-center gap-3 bg-bg-base rounded-xl px-3 py-2.5 text-[12px]">
                                <span className="text-[11px] text-text-muted font-mono w-16 flex-shrink-0">{log.time}</span>
                                <div className="w-6 h-6 flex-shrink-0 flex items-center justify-center">
                                    <GiftImage url={log.giftImage} name={log.giftName} size={24} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <span className="font-semibold text-accent-light">@{log.uniqueId}</span>
                                    <span className="text-text-muted"> → </span>
                                    <span className="text-accent-light/60">@{log.tiktokRecipient}</span>
                                    <span className="text-text-muted"> | </span>
                                    <span className="font-medium">{log.giftName}</span>
                                    <span className="text-text-muted"> x{log.repeatCount}</span>
                                </div>
                                <span className="text-accent-light font-semibold flex-shrink-0">💎 {log.total}</span>
                            </div>
                        ))}
                        <div ref={logEndRef} />
                    </div>
                </div>
            </div>
        </div>
    )
}

const lbl = "block text-[11px] text-text-muted uppercase tracking-wide mb-1.5"
const inp = "w-full bg-bg-base border border-accent/15 rounded-xl px-3 py-2.5 text-[13px] placeholder:text-text-muted outline-none focus:border-accent/40 transition"