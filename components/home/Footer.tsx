"use client"

// Footer ตามดีไซน์ใหม่: 4 คอลัมน์ (แบรนด์ / ข้อมูล / ติดต่อ / รับข่าวสาร)
// ลิงก์ทุกอันชี้ route ที่มีจริงในระบบ ไม่ใช้ # ลอย ๆ
import { useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Link } from "@/i18n/routing"

const DISCORD_URL = "https://discord.gg/vCuPy8H9ub"
const TIKTOK_URL = "https://www.tiktok.com/@a_class_store"
const YOUTUBE_URL = "https://www.youtube.com/@Khamin-m4h"

const Icon = {
  discord: <path d="M20.317 4.492c-1.53-.69-3.17-1.2-4.885-1.49a.075.075 0 0 0-.079.036c-.21.369-.444.85-.608 1.23a18.566 18.566 0 0 0-5.487 0 12.36 12.36 0 0 0-.617-1.23A.077.077 0 0 0 8.562 3c-1.714.29-3.354.8-4.885 1.491a.07.07 0 0 0-.032.027C.533 9.093-.32 13.555.099 17.961a.08.08 0 0 0 .031.055 20.03 20.03 0 0 0 5.993 2.98.078.078 0 0 0 .084-.026 13.83 13.83 0 0 0 1.226-1.963.074.074 0 0 0-.041-.104 13.201 13.201 0 0 1-1.872-.878.075.075 0 0 1-.008-.125c.126-.093.252-.19.372-.287a.075.075 0 0 1 .078-.01c3.927 1.764 8.18 1.764 12.061 0a.075.075 0 0 1 .079.009c.12.098.245.195.372.288a.075.075 0 0 1-.006.125c-.598.344-1.22.635-1.873.877a.075.075 0 0 0-.041.105c.36.687.772 1.341 1.225 1.962a.077.077 0 0 0 .084.028 19.963 19.963 0 0 0 6.002-2.981.076.076 0 0 0 .032-.054c.5-5.094-.838-9.52-3.549-13.442a.06.06 0 0 0-.031-.028zM8.02 15.278c-1.182 0-2.157-1.069-2.157-2.38 0-1.312.956-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.956 2.38-2.157 2.38zm7.975 0c-1.183 0-2.157-1.069-2.157-2.38 0-1.312.955-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.946 2.38-2.157 2.38z" />,
  tiktok: <path d="M12.53 1.5h3.4a5.6 5.6 0 0 0 5.07 5v3.4a8.9 8.9 0 0 1-5.07-1.6v7.02a6.32 6.32 0 1 1-6.32-6.32c.33 0 .65.03.96.08v3.5a2.9 2.9 0 1 0 2.02 2.76V1.5z" />,
  youtube: <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.6 15.6V8.4l6.2 3.6-6.2 3.6z" />,
}

function Social({ href, label, path }: { href: string; label: string; path: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label}
       className="w-9 h-9 rounded-lg bg-white/[0.04] border border-border-soft flex items-center justify-center text-text-dim hover:text-accent-light hover:bg-accent/10 hover:border-accent/20 transition-colors">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">{path}</svg>
    </a>
  )
}

export default function Footer() {
  const t = useTranslations("Footer")
  const locale = useLocale()
  const [email, setEmail] = useState("")
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle")

  const subscribe = async (e: React.FormEvent) => {
    e.preventDefault()
    if (state === "sending") return
    setState("sending")
    try {
      const r = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, locale }),
      })
      if (r.ok) { setState("done"); setEmail("") } else setState("error")
    } catch { setState("error") }
  }

  const links = [
    { href: "/products", label: t("link_products") },
    { href: "/rules", label: t("link_terms") },
    { href: "/faq", label: t("link_faq") },
    { href: "/contact", label: t("link_contact") },
  ]

  return (
    <footer className="border-t border-border-soft pt-12" style={{ background: "linear-gradient(180deg,var(--color-bg-base),#040710)" }}>
      <div className="w-full px-5 sm:px-7 lg:px-10 pb-11 grid gap-12 grid-cols-1 md:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1.3fr]">
        {/* แบรนด์ */}
        <div>
          <h3 className="text-[1.05rem] font-extrabold mb-3 flex items-center gap-2">
            <img src="/AClassStoreLogo.png" alt="" width={28} height={28} className="w-7 h-7 object-contain" />
            A CLASS STORE
          </h3>
          <p className="text-[0.78rem] text-text-dim leading-[1.7] mb-[18px]">{t("tagline")}</p>
          <div className="flex gap-2">
            <Social href={DISCORD_URL} label="Discord" path={Icon.discord} />
            <Social href={TIKTOK_URL} label="TikTok" path={Icon.tiktok} />
            <Social href={YOUTUBE_URL} label="YouTube" path={Icon.youtube} />
          </div>
        </div>

        {/* ข้อมูล */}
        <div>
          <h4 className="text-[0.85rem] font-bold mb-4">{t("col_info")}</h4>
          <ul>
            {links.map((l) => (
              <li key={l.href} className="mb-2.5">
                <Link href={l.href} className="text-[0.8rem] text-text-dim hover:text-text-base transition-colors">{l.label}</Link>
              </li>
            ))}
          </ul>
        </div>

        {/* ติดต่อ */}
        <div>
          <h4 className="text-[0.85rem] font-bold mb-4">{t("col_contact")}</h4>
          <ul>
            {[
              { href: TIKTOK_URL, icon: Icon.tiktok, label: "TikTok : A Class Store" },
              { href: DISCORD_URL, icon: Icon.discord, label: "Discord : A Class Store" },
              { href: YOUTUBE_URL, icon: Icon.youtube, label: "YouTube : A Class Store" },
            ].map((c) => (
              <li key={c.href} className="mb-2.5">
                <a href={c.href} target="_blank" rel="noopener noreferrer"
                   className="text-[0.8rem] text-text-dim hover:text-text-base transition-colors inline-flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="opacity-50">{c.icon}</svg>
                  {c.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* รับข่าวสาร */}
        <div>
          <h4 className="text-[0.85rem] font-bold mb-4">{t("col_newsletter")}</h4>
          <p className="text-[0.78rem] text-text-dim mb-3.5 leading-[1.65]">{t("newsletter_desc")}</p>
          <form onSubmit={subscribe} className="flex gap-2">
            <input
              type="email" required value={email} onChange={(e) => { setEmail(e.target.value); setState("idle") }}
              placeholder={t("newsletter_placeholder")}
              className="flex-1 min-w-0 px-3.5 py-[11px] rounded-lg bg-bg-card border border-border-soft text-text-base text-[0.8rem] outline-none focus:border-accent transition-colors placeholder:text-text-dim"
            />
            <button type="submit" disabled={state === "sending"}
                    className="px-[22px] py-[11px] rounded-lg bg-accent hover:bg-accent-light text-white text-[0.8rem] font-semibold whitespace-nowrap transition-colors disabled:opacity-60">
              {state === "sending" ? "..." : t("newsletter_button")}
            </button>
          </form>
          {state === "done" && <p className="text-[0.72rem] text-success mt-2">{t("newsletter_done")}</p>}
          {state === "error" && <p className="text-[0.72rem] text-hot mt-2">{t("newsletter_error")}</p>}
        </div>
      </div>

      <div className="w-full px-5 sm:px-7 lg:px-10 py-5 border-t border-border-soft flex flex-wrap justify-between items-center gap-2 text-[0.72rem] text-text-dim">
        <span>{t("rights")}</span>
        <span>{t("made_with")} <span className="text-hot">♥</span> {t("made_for")}</span>
      </div>
    </footer>
  )
}
