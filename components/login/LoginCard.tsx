"use client"

// การ์ดเข้าสู่ระบบตามดีไซน์ใหม่: โลโก้ร้าน · หัวเรื่อง · ปุ่ม Discord/Google · สิ่งที่ได้ 4 ข้อ · ข้อตกลง
import { Link } from "@/i18n/routing"
import { signIn } from "next-auth/react"
import { useTranslations } from "next-intl"

const svgProps = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const }

export default function LoginCard({ callbackUrl = "/" }: { callbackUrl?: string }) {
  const t = useTranslations("Login")

  const perks = [
    { label: t("order_history"), icon: <svg {...svgProps}><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></svg> },
    { label: t("instant_delivery"), icon: <svg {...svgProps}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg> },
    { label: t("exclusive_deals"), icon: <svg {...svgProps}><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg> },
    { label: t("support_247"), icon: <svg {...svgProps}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg> },
  ]

  return (
    <div className="w-full max-w-[460px] bg-bg-card border border-border-soft rounded-[18px] p-7 sm:p-9 shadow-[0_8px_40px_var(--color-shadow)]">
      {/* โลโก้ + หัวเรื่อง */}
      <div className="text-center mb-7">
        <img src="/AClassStoreLogo.png" alt="A Class Store" width={88} height={88} className="w-[88px] h-[88px] object-contain mx-auto mb-4 drop-shadow-[0_6px_24px_rgba(37,99,235,0.35)]" />
        <h1 className="text-[1.6rem] sm:text-[1.85rem] font-black leading-tight tracking-[-0.02em]">
          {t("welcome")}
          <span className="block bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(135deg,var(--color-accent-light),var(--color-accent-lighter))" }}>
            A Class Store
          </span>
        </h1>
        <p className="text-[0.88rem] text-text-muted leading-[1.7] mt-3">{t("desc")}</p>
      </div>

      {/* ปุ่มเข้าสู่ระบบ */}
      <div className="flex flex-col gap-3">
        <button
          onClick={() => signIn("discord", { callbackUrl })}
          className="w-full flex items-center justify-center gap-3 py-3.5 rounded-[10px] bg-discord hover:brightness-110 text-white text-on-accent text-[0.92rem] font-bold shadow-[0_4px_24px_rgba(88,101,242,0.3)] transition-all hover:-translate-y-0.5 active:scale-[0.98]"
        >
          <DiscordIcon />
          {t("continue_discord")}
        </button>
        <button
          onClick={() => signIn("google", { callbackUrl })}
          className="w-full flex items-center justify-center gap-3 py-3.5 rounded-[10px] bg-bg-base border border-border-soft hover:border-border-light hover:bg-white/[0.04] text-text-base text-[0.92rem] font-bold transition-all hover:-translate-y-0.5 active:scale-[0.98]"
        >
          <GoogleIcon />
          {t("continue_google")}
        </button>
        {process.env.NODE_ENV === "development" && (
          <button onClick={() => signIn("dev-admin", { callbackUrl })} className="text-[0.72rem] text-text-dim hover:text-text-base transition-colors">
            🛠️ Dev Admin Login
          </button>
        )}
      </div>

      {/* สิ่งที่คุณจะได้รับ */}
      <div className="flex items-center gap-3 my-6">
        <span className="flex-1 h-px bg-border-soft" />
        <span className="text-[0.7rem] font-semibold text-text-dim uppercase tracking-[0.06em]">{t("what_you_get")}</span>
        <span className="flex-1 h-px bg-border-soft" />
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {perks.map((p) => (
          <div key={p.label} className="flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] bg-bg-base border border-border-soft text-[0.78rem] text-text-muted">
            <span className="w-8 h-8 rounded-lg bg-accent/10 text-accent-light flex items-center justify-center shrink-0">{p.icon}</span>
            {p.label}
          </div>
        ))}
      </div>

      {/* ข้อตกลง */}
      <p className="text-center text-[0.7rem] text-text-dim leading-relaxed mt-6">
        {t.rich("agreement", {
          terms: (chunks) => <Link href="/rules" className="text-accent-light hover:underline">{chunks}</Link>,
          privacy: (chunks) => <Link href="/privacy" className="text-accent-light hover:underline">{chunks}</Link>,
        })}
      </p>
    </div>
  )
}

function DiscordIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}
