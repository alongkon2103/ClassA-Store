"use client"

import Link from "next/link"
import { signIn } from "next-auth/react"

interface LoginCardProps {
  callbackUrl?: string
}

export default function LoginCard({ callbackUrl = "/" }: LoginCardProps) {
  return (
    <div className="login-card relative z-10 w-full max-w-[420px] rounded-3xl p-9">

      {/* ── Icon ── */}
      {/* <div className="anim-icon flex justify-center mb-6">
        <div className="w-[72px] h-[72px] rounded-2xl flex items-center justify-center pulse-ring"
             style={{ background: "var(--color-discord-bg)" }}>
          <svg width="36" height="36" viewBox="0 0 24 24"
               style={{ fill: "var(--color-discord-icon)" }}>
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
          </svg>
        </div>
      </div> */}

      {/* ── Title ── */}
      <div className="anim-title text-center mb-2">
        <h1 className="font-display font-bold text-[32px] leading-tight"
            style={{ color: "var(--color-text-base)" }}>
          Welcome to<br />
          <span style={{ color: "var(--color-accent-light)" }}>Class A Store</span>
        </h1>
      </div>

      {/* ── Desc ── */}
      <p className="anim-desc text-center text-[14px] leading-relaxed mb-8"
         style={{ color: "var(--color-text-muted)" }}>
        Sign in to access your orders, get support, and receive exclusive deals.
      </p>

      {/* ── Auth Buttons ── */}
      <div className="anim-btn flex flex-col gap-3 mb-6">

        {/* Discord */}
        <button
          onClick={() => signIn("discord", { callbackUrl })}
          className="btn-provider w-full flex items-center justify-center gap-3 text-white font-medium text-[15px] px-6 py-3.5 rounded-xl transition-all"
          style={{
            background: "var(--color-discord)",
            boxShadow: "0 4px 24px rgba(88,101,242,0.25)",
          }}
        >
          <DiscordIcon size={20} />
          Continue with Discord
        </button>

        {/* Google */}
        <button
          onClick={() => signIn("google", { callbackUrl })}
          className="btn-provider-outline w-full flex items-center justify-center gap-3 font-medium text-[15px] px-6 py-3.5 rounded-xl transition-all"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid var(--color-border-soft)",
            color: "var(--color-text-base)",
          }}
        >
          <GoogleIcon size={20} />
          Continue with Google
        </button>
      </div>

      {/* ── Divider ── */}
      <div className="anim-pills flex items-center gap-3 mb-6">
        <hr className="flex-1" style={{ borderColor: "var(--color-border-soft)" }} />
        <span className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>What you get</span>
        <hr className="flex-1" style={{ borderColor: "var(--color-border-soft)" }} />
      </div>

      {/* ── Feature Pills ── */}
      <div className="anim-pills flex flex-wrap gap-2 justify-center mb-8">
        {[
          { label: "Order history",       color: "var(--color-accent-light)" },
          { label: "Instant key delivery", color: "var(--color-accent-light)" },
          { label: "Exclusive deals",      color: "var(--color-gold)" },
          { label: "24/7 support",         color: "var(--color-accent-light)" },
        ].map(({ label, color }) => (
          <span
            key={label}
            className="text-[12px] px-3 py-1.5 rounded-full flex items-center gap-1.5"
            style={{
              background: "rgba(66,122,181,0.08)",
              border: "1px solid var(--color-border-soft)",
              color: "var(--color-text-muted)",
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full inline-block shrink-0"
                  style={{ background: color }} />
            {label}
          </span>
        ))}
      </div>

      {/* ── Footer note ── */}
      <p className="anim-footer text-center text-[11px]"
         style={{ color: "var(--color-text-muted)", opacity: .7 }}>
        By continuing you agree to our{" "}
        <Link href="/terms" style={{ color: "var(--color-accent-light)" }} className="hover:underline">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="/privacy" style={{ color: "var(--color-accent-light)" }} className="hover:underline">
          Privacy Policy
        </Link>
      </p>
    </div>
  )
}

/* ── Icon components ── */
function DiscordIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="white">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
    </svg>
  )
}

function GoogleIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}