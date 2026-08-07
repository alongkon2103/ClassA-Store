"use client"

import { useState } from "react"
import { signOut } from "next-auth/react"
import { useTranslations } from "next-intl"

type Props = {
  ok: boolean
  state: string
  port: string
  challenge: string
  account: { name: string | null; email: string | null; image: string | null }
}

export default function DesktopLoginClient({ ok, state, port, challenge, account }: Props) {
  const t = useTranslations("DesktopLogin")
  const [status, setStatus] = useState<"idle" | "authorizing" | "done" | "error">("idle")
  const [err, setErr] = useState<string | null>(null)

  const authorize = async () => {
    setStatus("authorizing")
    setErr(null)
    try {
      const res = await fetch("/api/desktop/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state, port: Number(port), challenge }),
      })
      if (!res.ok) {
        setErr((await res.json().catch(() => ({}))).error || t("error"))
        setStatus("error")
        return
      }
      const { redirect } = await res.json()
      setStatus("done")
      // Hand the one-time code to the local app via its loopback listener.
      window.location.href = redirect
    } catch {
      setErr(t("error"))
      setStatus("error")
    }
  }

  // Sign out of the web session and come straight back to this consent page —
  // which, now session-less, bounces to the provider chooser (Discord/Google).
  const switchAccount = () => {
    const back = `/desktop/login?${new URLSearchParams({ state, port, challenge }).toString()}`
    signOut({ callbackUrl: back })
  }

  return (
    <main className="min-h-screen bg-bg-base flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-bg-card border border-accent/10 rounded-2xl p-7 text-center">
        <div className="w-12 h-12 rounded-xl bg-accent/12 text-accent-light flex items-center justify-center mx-auto mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
          </svg>
        </div>

        <h1 className="text-[19px] font-bold">{t("title")}</h1>

        {!ok ? (
          <p className="text-[13px] text-red-300 mt-3">{t("bad_request")}</p>
        ) : status === "done" ? (
          <>
            <p className="text-[13px] text-text-muted mt-3">{t("returning")}</p>
            <p className="text-[12px] text-text-muted mt-4">{t("close_hint")}</p>
          </>
        ) : (
          <>
            <p className="text-[13px] text-text-muted mt-2">{t("subtitle")}</p>

            <div className="flex items-center gap-3 bg-white/[0.03] border border-white/5 rounded-xl p-3 mt-5 text-left">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {account.image ? <img src={account.image} alt="" className="w-9 h-9 rounded-full" /> : <div className="w-9 h-9 rounded-full bg-accent/15" />}
              <div className="min-w-0">
                <p className="text-[13px] font-medium truncate">{account.name ?? t("your_account")}</p>
                {account.email && <p className="text-[11px] text-text-muted truncate">{account.email}</p>}
              </div>
            </div>

            <p className="text-[11px] text-text-muted mt-3">{t("consent")}</p>

            <button
              onClick={authorize}
              disabled={status === "authorizing"}
              className="w-full mt-5 px-5 py-3 rounded-xl bg-accent text-white text-[14px] font-semibold shadow-lg shadow-accent/20 hover:bg-accent/90 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {status === "authorizing" ? t("authorizing") : t("authorize")}
            </button>

            {err && <p className="text-[12px] text-red-300 mt-3">{err}</p>}

            <button
              onClick={switchAccount}
              disabled={status === "authorizing"}
              className="text-[11px] text-text-muted mt-4 underline underline-offset-2 hover:text-text-base transition-colors disabled:opacity-50"
            >
              {t("switch_account")}
            </button>
          </>
        )}
      </div>
    </main>
  )
}
