"use client"

// การ์ดชวนเข้า Discord ตามดีไซน์ใหม่ — กล่องกลางจอ ไอคอนไล่สี Discord
import { useTranslations } from "next-intl"

const DISCORD_URL = "https://discord.gg/vCuPy8H9ub"

function DiscordGlyph({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.492c-1.53-.69-3.17-1.2-4.885-1.49a.075.075 0 0 0-.079.036c-.21.369-.444.85-.608 1.23a18.566 18.566 0 0 0-5.487 0 12.36 12.36 0 0 0-.617-1.23A.077.077 0 0 0 8.562 3c-1.714.29-3.354.8-4.885 1.491a.07.07 0 0 0-.032.027C.533 9.093-.32 13.555.099 17.961a.08.08 0 0 0 .031.055 20.03 20.03 0 0 0 5.993 2.98.078.078 0 0 0 .084-.026 13.83 13.83 0 0 0 1.226-1.963.074.074 0 0 0-.041-.104 13.201 13.201 0 0 1-1.872-.878.075.075 0 0 1-.008-.125c.126-.093.252-.19.372-.287a.075.075 0 0 1 .078-.01c3.927 1.764 8.18 1.764 12.061 0a.075.075 0 0 1 .079.009c.12.098.245.195.372.288a.075.075 0 0 1-.006.125c-.598.344-1.22.635-1.873.877a.075.075 0 0 0-.041.105c.36.687.772 1.341 1.225 1.962a.077.077 0 0 0 .084.028 19.963 19.963 0 0 0 6.002-2.981.076.076 0 0 0 .032-.054c.5-5.094-.838-9.52-3.549-13.442a.06.06 0 0 0-.031-.028zM8.02 15.278c-1.182 0-2.157-1.069-2.157-2.38 0-1.312.956-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.956 2.38-2.157 2.38zm7.975 0c-1.183 0-2.157-1.069-2.157-2.38 0-1.312.955-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.946 2.38-2.157 2.38z" />
    </svg>
  )
}

export default function JoinDc() {
  const t = useTranslations("Home")

  return (
    <div className="max-w-[1248px] mx-auto px-6 mb-12">
      <section
        className="relative overflow-hidden text-center px-6 py-[60px] rounded-2xl border border-border-soft"
        style={{ background: "linear-gradient(180deg,var(--color-bg-surface),rgba(6,10,20,0.6))" }}
      >
        <div aria-hidden className="absolute inset-0 pointer-events-none"
             style={{ background: "radial-gradient(circle at 50% 30%,rgba(88,101,242,0.08) 0%,transparent 60%)" }} />

        <div className="relative">
          <div className="w-[60px] h-[60px] mx-auto mb-[22px] rounded-2xl flex items-center justify-center text-white shadow-[0_4px_24px_rgba(88,101,242,0.3)]"
               style={{ background: "linear-gradient(135deg,#5865F2,#7289da)" }}>
            <DiscordGlyph />
          </div>

          <h2 className="text-[1.4rem] sm:text-[1.8rem] font-extrabold mb-3">{t("join_discord")}</h2>
          <p className="text-text-muted text-[0.88rem] max-w-[500px] mx-auto mb-7 leading-[1.75]">{t("join_discord_desc")}</p>

          <a
            href={DISCORD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2.5 px-[34px] py-3.5 rounded-[10px] bg-discord hover:brightness-110 text-white text-[0.9rem] font-bold transition-all hover:-translate-y-0.5 active:scale-95 shadow-[0_4px_20px_rgba(88,101,242,0.25)]"
          >
            <DiscordGlyph size={18} />
            {t("join_discord_button")}
          </a>
        </div>
      </section>
    </div>
  )
}
