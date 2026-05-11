"use client"

import { useEffect, useRef, useState, useCallback } from "react"

const API_URL = process.env.NEXT_PUBLIC_TIKTOK_API_URL || "http://localhost:4000"
const WS_URL  = process.env.NEXT_PUBLIC_TIKTOK_WS_URL  || "ws://localhost:4001"
const API_KEY = process.env.NEXT_PUBLIC_TIKTOK_API_KEY  || ""

type WorkerStatus = "connecting" | "running" | "reconnecting" | "stopped" | "error"

type Worker = {
  username:  string
  status:    WorkerStatus
  startedAt: number
  uptime:    number | null
}

type LiveEvent = {
  type:        string
  tiktok:      string
  sender:      string
  nickname:    string
  giftName?:   string
  diamonds?:   number
  repeatCount?: number
  total?:       number
  comment?:    string
  likeCount?:  number
  ts:          number
}

const STATUS_COLOR: Record<WorkerStatus, string> = {
  connecting:   "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  running:      "text-green-400 bg-green-500/10 border-green-500/20",
  reconnecting: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  stopped:      "text-text-muted bg-white/5 border-white/10",
  error:        "text-red-400 bg-red-500/10 border-red-500/20",
}

const EVENT_COLOR: Record<string, string> = {
  gift:   "text-yellow-400",
  chat:   "text-accent-light",
  like:   "text-pink-400",
  follow: "text-green-400",
}

function formatUptime(ms: number | null) {
  if (!ms) return "—"
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  if (h > 0) return `${h}h ${m % 60}m`
  if (m > 0) return `${m}m ${s % 60}s`
  return `${s}s`
}

function formatEvent(ev: LiveEvent) {
  switch (ev.type) {
    case "gift":   return `🎁 ${ev.nickname} → ${ev.giftName} x${ev.repeatCount} (💎${ev.total})`
    case "chat":   return `💬 ${ev.nickname}: ${ev.comment}`
    case "like":   return `❤️ ${ev.nickname} liked x${ev.likeCount}`
    case "follow": return `➕ ${ev.nickname} followed`
    default:       return JSON.stringify(ev)
  }
}

export default function TikTokLiveClient() {
  const [workers, setWorkers]     = useState<Worker[]>([])
  const [events, setEvents]       = useState<(LiveEvent & { id: string })[]>([])
  const [input, setInput]         = useState("")
  const [loading, setLoading]     = useState<string | null>(null)
  const [filter, setFilter]       = useState("all")
  const [wsStatus, setWsStatus]   = useState<"connected" | "disconnected">("disconnected")
  const wsRef    = useRef<WebSocket | null>(null)
  const evEndRef = useRef<HTMLDivElement>(null)

  // ── Fetch initial status ──────────────────────────────────
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/status`, {
        headers: API_KEY ? { "X-API-Key": API_KEY } : {},
      })
      const data = await res.json()
      setWorkers(data.workers ?? [])
    } catch {}
  }, [])

  useEffect(() => {
    fetchStatus()
    const t = setInterval(fetchStatus, 10000)
    return () => clearInterval(t)
  }, [fetchStatus])

  // ── WebSocket ──────────────────────────────────────────────
  useEffect(() => {
    let ws: WebSocket
    let retryTimeout: NodeJS.Timeout

    function connect() {
      ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        setWsStatus("connected")
        ws.send(JSON.stringify({ type: "subscribe" }))
      }

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data)

          if (msg.type === "status_update" && msg.workers) {
            setWorkers(msg.workers)
            return
          }

          // Live event
          if (["gift", "chat", "like", "follow"].includes(msg.type)) {
            const entry = { ...msg, id: Math.random().toString(36).slice(2) }
            setEvents((prev) => [...prev.slice(-199), entry])
          }
        } catch {}
      }

      ws.onclose = () => {
        setWsStatus("disconnected")
        retryTimeout = setTimeout(connect, 3000)
      }

      ws.onerror = () => {
        ws.close()
      }
    }

    connect()
    return () => {
      clearTimeout(retryTimeout)
      ws?.close()
    }
  }, [])

  useEffect(() => {
    evEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [events])

  // ── Toggle ──────────────────────────────────────────────────
  const handleToggle = async (username: string) => {
    const u = username.trim().replace("@", "")
    if (!u) return
    setLoading(u)
    try {
      const res = await fetch(`${API_URL}/toggle`, {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          ...(API_KEY ? { "X-API-Key": API_KEY } : {}),
        },
        body: JSON.stringify({ username: u }),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error); return }
      await fetchStatus()
      setInput("")
    } catch (e) {
      alert("Cannot connect to TikTok service")
    } finally {
      setLoading(null)
    }
  }

  const filteredEvents = filter === "all"
    ? events
    : events.filter(e => e.type === filter)

  const runningCount = workers.filter(w => w.status === "running").length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-bold">TikTok LIVE Monitor</h1>
          <p className="text-text-muted text-[13px] mt-0.5">
            Manage TikTok LIVE connections and monitor events
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[12px] font-medium ${
            wsStatus === "connected"
              ? "bg-green-500/10 border-green-500/20 text-green-400"
              : "bg-red-500/10 border-red-500/20 text-red-400"
          }`}>
            <div className={`w-2 h-2 rounded-full ${wsStatus === "connected" ? "bg-green-400 animate-pulse" : "bg-red-400"}`} />
            {wsStatus === "connected" ? "Gateway Connected" : "Gateway Disconnected"}
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-accent/10 border border-accent/20 text-[12px] text-accent-light font-medium">
            {runningCount} Live
          </div>
        </div>
      </div>

      {/* Input */}
      <div className="bg-bg-card border border-accent/10 rounded-2xl p-5">
        <p className="text-[13px] font-semibold mb-3">Connect TikTok LIVE</p>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-[13px]">@</span>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleToggle(input)}
              placeholder="tiktok_username"
              className="w-full bg-bg-base border border-accent/15 rounded-xl pl-7 pr-4 py-3 text-[13px] placeholder:text-text-muted outline-none focus:border-accent/40 transition"
            />
          </div>
          <button
            onClick={() => handleToggle(input)}
            disabled={!input.trim() || !!loading}
            className="px-6 py-3 rounded-xl bg-accent text-white font-semibold text-[13px] hover:opacity-90 transition disabled:opacity-40 flex items-center gap-2"
          >
            {loading === input.trim().replace("@", "") ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : null}
            Start
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Workers List */}
        <div className="bg-bg-card border border-accent/10 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5">
            <p className="text-[13px] font-semibold">Active Connections</p>
            <p className="text-[11px] text-text-muted">{workers.length} total</p>
          </div>
          <div className="divide-y divide-white/5 max-h-[500px] overflow-y-auto">
            {workers.length === 0 && (
              <div className="text-center py-10 text-text-muted text-[13px]">
                No connections yet
              </div>
            )}
            {workers.map((w) => (
              <div key={w.username} className="px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium">@{w.username}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${STATUS_COLOR[w.status]}`}>
                      {w.status}
                    </span>
                    {w.status === "running" && (
                      <span className="text-[10px] text-text-muted">{formatUptime(w.uptime)}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleToggle(w.username)}
                  disabled={loading === w.username}
                  className={`text-[11px] px-3 py-1.5 rounded-lg border transition ${
                    w.status === "running" || w.status === "reconnecting"
                      ? "border-red-500/20 text-red-400 hover:bg-red-500/10"
                      : "border-green-500/20 text-green-400 hover:bg-green-500/10"
                  }`}
                >
                  {loading === w.username ? "..." : w.status === "running" || w.status === "reconnecting" ? "Stop" : "Start"}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Event Log */}
        <div className="lg:col-span-2 bg-bg-card border border-accent/10 rounded-2xl overflow-hidden flex flex-col" style={{ maxHeight: "560px" }}>
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
            <div>
              <p className="text-[13px] font-semibold">Live Events</p>
              <p className="text-[11px] text-text-muted">{filteredEvents.length} events</p>
            </div>
            <div className="flex gap-1 bg-bg-base border border-accent/10 rounded-xl p-1">
              {["all", "gift", "chat", "like", "follow"].map((f) => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition capitalize ${
                    filter === f ? "bg-accent/20 text-accent-light" : "text-text-muted hover:text-text-base"
                  }`}>
                  {f}
                </button>
              ))}
            </div>
            <button onClick={() => setEvents([])}
              className="text-[12px] text-text-muted hover:text-text-base transition">
              Clear
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-1.5 font-mono text-[12px]">
            {filteredEvents.length === 0 && (
              <div className="text-center py-12 text-text-muted text-[13px] font-sans">
                Waiting for events...
              </div>
            )}
            {filteredEvents.map((ev) => (
              <div key={ev.id} className="flex items-start gap-2">
                <span className="text-text-muted/50 flex-shrink-0 text-[10px] mt-0.5">
                  {new Date(ev.ts).toLocaleTimeString()}
                </span>
                <span className="text-accent-light/60 flex-shrink-0">@{ev.tiktok}</span>
                <span className={EVENT_COLOR[ev.type] ?? "text-text-muted"}>
                  {formatEvent(ev)}
                </span>
              </div>
            ))}
            <div ref={evEndRef} />
          </div>
        </div>
      </div>
    </div>
  )
}