"use client"

import { useState, useRef, useEffect } from "react"

const GIFTS = [
  { id: 1, name: "Rose", icon: "🌹", diamonds: 1 },
  { id: 5, name: "TikTok", icon: "📱", diamonds: 1 },
  { id: 10, name: "Finger Heart", icon: "🤏", diamonds: 5 },
  { id: 20, name: "Sun Cream", icon: "🧴", diamonds: 10 },
  { id: 30, name: "GG", icon: "🎮", diamonds: 10 },
  { id: 40, name: "Ice Cream", icon: "🍦", diamonds: 30 },
  { id: 50, name: "Mic", icon: "🎤", diamonds: 50 },
  { id: 60, name: "Crown", icon: "👑", diamonds: 100 },
  { id: 70, name: "Airplane", icon: "✈️", diamonds: 99 },
  { id: 80, name: "Lion", icon: "🦁", diamonds: 500 },
  { id: 90, name: "Universe", icon: "🌌", diamonds: 1000 },
  { id: 100, name: "Drama Queen", icon: "👸", diamonds: 5000 },
]

type LogEntry = {
  id: string
  time: string
  uniqueId: string
  nickname: string
  robloxUsername: string
  giftName: string
  giftIcon: string
  diamonds: number
  repeatCount: number
  total: number
}

// simulate tiktok-live-connector event format
function buildGiftEvent(
  username: string,
  nickname: string,
  robloxUsername: string,
  gift: typeof GIFTS[0],
  count: number
) {
  return {
    userId: Math.floor(Math.random() * 9999999999).toString(),
    uniqueId: username,
    nickname: nickname || username,

    // เพิ่ม Roblox Username
    robloxUsername: robloxUsername || "",

    profilePictureUrl: "",
    followRole: 0,
    giftId: gift.id,
    giftName: gift.name,
    giftPictureUrl: "",
    diamondCount: gift.diamonds,
    repeatCount: count,
    repeatEnd: true,
    msgId: Date.now().toString(),
    createTime: Date.now(),
  }
}

export default function TikTokSimulator() {
  const [username, setUsername] = useState("user_test")
  const [nickname, setNickname] = useState("Test User")
  const [robloxUsername, setRobloxUsername] = useState("Alongkon123")

  const [selectedGift, setSelectedGift] = useState(GIFTS[0])
  const [repeatCount, setRepeatCount] = useState(1)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [sending, setSending] = useState(false)
  const [autoMode, setAutoMode] = useState(false)
  const [autoInterval, setAutoIntervalVal] = useState(3)

  const autoRef = useRef<NodeJS.Timeout | null>(null)
  const logEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [logs])

  const sendGift = async (
    overrideGift?: typeof GIFTS[0],
    overrideCount?: number
  ) => {
    const gift = overrideGift ?? selectedGift
    const count = overrideCount ?? repeatCount

    setSending(true)

    const event = buildGiftEvent(
      username,
      nickname,
      robloxUsername,
      gift,
      count
    )

    try {
      const res = await fetch("/api/admin/tiktok-simulator/gift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(event),
      })

      await res.json()

      const entry: LogEntry = {
        id: Math.random().toString(36).slice(2),
        time: new Date().toLocaleTimeString(),
        uniqueId: event.uniqueId,
        nickname: event.nickname,
        robloxUsername: event.robloxUsername,
        giftName: gift.name,
        giftIcon: gift.icon,
        diamonds: gift.diamonds,
        repeatCount: count,
        total: gift.diamonds * count,
      }

      setLogs((l) => [...l.slice(-99), entry])
    } catch (err) {
      console.error(err)
    } finally {
      setSending(false)
    }
  }

  // Auto mode
  useEffect(() => {
    if (autoMode) {
      autoRef.current = setInterval(() => {
        const randomGift =
          GIFTS[Math.floor(Math.random() * GIFTS.length)]
        const randomCount =
          Math.floor(Math.random() * 10) + 1

        sendGift(randomGift, randomCount)
      }, autoInterval * 1000)
    } else {
      if (autoRef.current) clearInterval(autoRef.current)
    }

    return () => {
      if (autoRef.current) clearInterval(autoRef.current)
    }
  }, [autoMode, autoInterval, username, nickname, robloxUsername])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-bold">
            TikTok Gift Simulator
          </h1>
          <p className="text-text-muted text-[13px] mt-0.5">
            Simulate TikTok LIVE gift events for testing
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20">
          <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
          <span className="text-[12px] text-orange-400 font-medium">
            Dev Only
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT — Controls */}
        <div className="space-y-4">
          {/* User Info */}
          <div className="bg-bg-card border border-accent/10 rounded-2xl p-5 space-y-3">
            <p className="text-[13px] font-semibold">
              Sender Info
            </p>

            {/* TikTok Username */}
            <div>
              <label className={lbl}>TikTok Username</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-[13px]">
                  @
                </span>
                <input
                  value={username}
                  onChange={(e) =>
                    setUsername(e.target.value)
                  }
                  placeholder="username"
                  className={`${inp} pl-7`}
                />
              </div>
            </div>

            {/* Nickname */}
            <div>
              <label className={lbl}>Nickname</label>
              <input
                value={nickname}
                onChange={(e) =>
                  setNickname(e.target.value)
                }
                placeholder="Display Name"
                className={inp}
              />
            </div>

            {/* Roblox Username */}
            <div>
              <label className={lbl}>Roblox Username</label>
              <input
                value={robloxUsername}
                onChange={(e) =>
                  setRobloxUsername(e.target.value)
                }
                placeholder="Roblox Username"
                className={inp}
              />
            </div>
          </div>

          {/* Gift Selector */}
          <div className="bg-bg-card border border-accent/10 rounded-2xl p-5 space-y-3">
            <p className="text-[13px] font-semibold">
              Select Gift
            </p>

            <div className="grid grid-cols-3 gap-2">
              {GIFTS.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setSelectedGift(g)}
                  className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border text-center transition ${selectedGift.id === g.id
                      ? "border-accent bg-accent/10"
                      : "border-white/10 hover:border-accent/30"
                    }`}
                >
                  <span className="text-2xl">{g.icon}</span>
                  <p className="text-[11px] font-medium truncate w-full text-center">
                    {g.name}
                  </p>
                  <p className="text-[10px] text-accent-light">
                    💎 {g.diamonds}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Count + Send */}
          <div className="bg-bg-card border border-accent/10 rounded-2xl p-5 space-y-3">
            <p className="text-[13px] font-semibold">
              Send Options
            </p>

            <div>
              <label className={lbl}>Repeat Count</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={1}
                  max={100}
                  value={repeatCount}
                  onChange={(e) =>
                    setRepeatCount(
                      Number(e.target.value)
                    )
                  }
                  className="flex-1"
                />
                <span className="text-[14px] font-bold text-accent-light w-8 text-right">
                  {repeatCount}
                </span>
              </div>
              <p className="text-[11px] text-text-muted mt-1">
                Total: 💎{" "}
                {selectedGift.diamonds * repeatCount} diamonds
              </p>
            </div>

            {/* Quick counts */}
            <div className="flex gap-2 flex-wrap">
              {[1, 5, 10, 25, 50, 99].map((n) => (
                <button
                  key={n}
                  onClick={() => setRepeatCount(n)}
                  className={`px-3 py-1 rounded-lg text-[12px] border transition ${repeatCount === n
                      ? "border-accent bg-accent/15 text-accent-light"
                      : "border-white/10 text-text-muted hover:border-accent/30"
                    }`}
                >
                  x{n}
                </button>
              ))}
            </div>

            <button
              onClick={() => sendGift()}
              disabled={sending || autoMode}
              className="w-full py-3 rounded-xl bg-accent text-white font-semibold text-[14px] hover:opacity-90 transition disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {sending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  {selectedGift.icon} Send{" "}
                  {selectedGift.name} x{repeatCount}
                </>
              )}
            </button>
          </div>

          {/* Auto Mode */}
          <div className="bg-bg-card border border-accent/10 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-semibold">
                Auto Mode
              </p>
              <button
                onClick={() =>
                  setAutoMode((v) => !v)
                }
                className={`w-12 h-6 rounded-full transition-colors relative ${autoMode
                    ? "bg-green-500"
                    : "bg-white/10"
                  }`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${autoMode ? "left-7" : "left-1"
                    }`}
                />
              </button>
            </div>

            <p className="text-[11px] text-text-muted">
              Auto send random gifts continuously for
              stress testing
            </p>

            <div>
              <label className={lbl}>
                Interval (seconds)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={autoInterval}
                  onChange={(e) =>
                    setAutoIntervalVal(
                      Number(e.target.value)
                    )
                  }
                  className="flex-1"
                />
                <span className="text-[14px] font-bold text-accent-light w-6 text-right">
                  {autoInterval}s
                </span>
              </div>
            </div>

            {autoMode && (
              <div className="flex items-center gap-2 text-[12px] text-green-400">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                Running — sending every {autoInterval}s
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — Event Log */}
        <div
          className="bg-bg-card border border-accent/10 rounded-2xl overflow-hidden flex flex-col"
          style={{ maxHeight: "700px" }}
        >
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
            <div>
              <p className="text-[13px] font-semibold">
                Event Log
              </p>
              <p className="text-[11px] text-text-muted">
                {logs.length} events
              </p>
            </div>

            <button
              onClick={() => setLogs([])}
              className="text-[12px] text-text-muted hover:text-text-base transition"
            >
              Clear
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {logs.length === 0 && (
              <div className="text-center py-12 text-text-muted text-[13px]">
                No events yet — send a gift to start
              </div>
            )}

            {logs.map((log) => (
              <div
                key={log.id}
                className="flex items-center gap-3 bg-bg-base rounded-xl px-3 py-2.5 text-[12px]"
              >
                <span className="text-[11px] text-text-muted font-mono w-16 flex-shrink-0">
                  {log.time}
                </span>

                <span className="text-xl flex-shrink-0">
                  {log.giftIcon}
                </span>

                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-accent-light">
                    @{log.uniqueId}
                  </span>
                  <span className="text-text-muted">
                    {" "}
                    ({log.robloxUsername}) sent{" "}
                  </span>
                  <span className="font-medium">
                    {log.giftName}
                  </span>
                  <span className="text-text-muted">
                    {" "}
                    x{log.repeatCount}
                  </span>
                </div>

                <span className="text-accent-light font-semibold flex-shrink-0">
                  💎 {log.total}
                </span>
              </div>
            ))}

            <div ref={logEndRef} />
          </div>
        </div>
      </div>
    </div>
  )
}

const lbl =
  "block text-[11px] text-text-muted uppercase tracking-wide mb-1.5"

const inp =
  "w-full bg-bg-base border border-accent/15 rounded-xl px-3 py-2.5 text-[13px] placeholder:text-text-muted outline-none focus:border-accent/40 transition"