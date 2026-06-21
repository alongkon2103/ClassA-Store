import { setRequestLocale, getTranslations } from "next-intl/server"
import Navbar from "@/components/Navbar"
import Footer from "@/components/home/Footer"

export const dynamic = "force-static"

const TIKTOK_URL = "https://www.tiktok.com/@a_class_store"
const YOUTUBE_URL = "https://www.youtube.com/@Khamin-m4h"
const DISCORD_URL = "https://discord.gg/vCuPy8H9ub"

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations("Contact")

  return (
    <div className="min-h-screen bg-bg-base flex flex-col selection:bg-accent/30 selection:text-accent-light">
      <Navbar />

      <main className="flex-1 relative">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-accent/5 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2" />
        </div>

        <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 py-10 md:py-16">
          <header className="mb-8 md:mb-10">
            <div className="flex items-center gap-2 text-accent-light text-[10px] md:text-[11px] font-bold uppercase tracking-[0.2em] mb-2">
              <span className="w-6 md:w-8 h-[2px] bg-accent/40" />
              {t("eyebrow")}
            </div>
            <h1 className="text-3xl md:text-4xl font-display font-bold text-text-base mb-2">
              {t("title")}
            </h1>
            <p className="text-text-muted text-[13px] md:text-[14px] max-w-xl">
              {t("subtitle")}
            </p>
          </header>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <a
              href={TIKTOK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-bg-card border border-accent/15 hover:border-accent/40 rounded-2xl p-5 transition-all hover:-translate-y-0.5 no-underline"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center shrink-0">
                  <TikTokIcon />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-wider text-text-muted">
                    TikTok
                  </p>
                  <p className="text-[14px] font-semibold text-text-base truncate">
                    A Class Store
                  </p>
                </div>
              </div>
              <p className="text-[12px] text-text-muted leading-relaxed">
                {t("tiktok_desc")}
              </p>
            </a>

            <a
              href={YOUTUBE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-bg-card border border-accent/15 hover:border-accent/40 rounded-2xl p-5 transition-all hover:-translate-y-0.5 no-underline"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-[#ff0000] flex items-center justify-center shrink-0">
                  <YouTubeIcon />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-wider text-text-muted">
                    YouTube
                  </p>
                  <p className="text-[14px] font-semibold text-text-base truncate">
                    A Class Store
                  </p>
                </div>
              </div>
              <p className="text-[12px] text-text-muted leading-relaxed">
                {t("youtube_desc")}
              </p>
            </a>

            <a
              href={DISCORD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-bg-card border border-accent/15 hover:border-accent/40 rounded-2xl p-5 transition-all hover:-translate-y-0.5 no-underline"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-[#5865f2] flex items-center justify-center shrink-0">
                  <DiscordIcon />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-wider text-text-muted">
                    Discord
                  </p>
                  <p className="text-[14px] font-semibold text-text-base truncate">
                    [👑]▸A Class Store
                  </p>
                </div>
              </div>
              <p className="text-[12px] text-text-muted leading-relaxed">
                {t("discord_desc")}
              </p>
            </a>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}

function TikTokIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43V8.93a8.16 8.16 0 0 0 4.77 1.52V7a4.85 4.85 0 0 1-1.84-.31z" />
    </svg>
  )
}

function YouTubeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  )
}

function DiscordIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  )
}
