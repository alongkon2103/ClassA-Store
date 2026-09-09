import type { Metadata } from "next"
import { setRequestLocale, getTranslations } from "next-intl/server"
import { Link } from "@/i18n/routing"
import Navbar from "@/components/Navbar"
import Footer from "@/components/home/Footer"
import { prisma } from "@/lib/prisma"
import { PRIVACY_BY_LOCALE, PRIVACY_UPDATED } from "@/lib/content/privacy"
import { localeTag } from "@/lib/i18n/locale"

// นโยบายความเป็นส่วนตัว — เนื้อหาหลักอยู่ใน lib/content/privacy.ts
// ถ้าแอดมินใส่ system_configs `privacy_<locale>` (HTML) จะแสดงของนั้นแทน (แบบเดียวกับหน้ากฎ)
export const revalidate = 60

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "Privacy" })
  return { title: t("meta_title"), description: t("meta_desc") }
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations("Privacy")

  const row = await prisma.system_configs.findUnique({ where: { key: `privacy_${locale}` } }).catch(() => null)
  const override = (row?.value ?? "").trim()
  const sections = PRIVACY_BY_LOCALE[locale] ?? PRIVACY_BY_LOCALE.en
  const updated = new Date(PRIVACY_UPDATED).toLocaleDateString(localeTag(locale), { day: "numeric", month: "long", year: "numeric" })

  return (
    <div className="min-h-screen bg-bg-base flex flex-col selection:bg-accent/30 selection:text-accent-light">
      <Navbar />
      <main className="flex-1 relative">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-accent/5 rounded-full blur-[120px] -translate-y-1/2 -translate-x-1/2" />
        </div>

        <div className="page-container relative z-10 py-10 md:py-14">
          <header className="mb-8">
            <div className="flex items-center gap-2 text-accent-light text-[0.7rem] font-bold uppercase tracking-[0.2em] mb-2">
              <span className="w-6 h-[2px] bg-accent/40" />
              {t("eyebrow")}
            </div>
            <h1 className="text-[1.6rem] md:text-[2.2rem] font-black tracking-[-0.02em] mb-2">{t("title")}</h1>
            <p className="text-text-muted text-[0.88rem] max-w-2xl leading-[1.7]">{t("subtitle")}</p>
            <p className="text-text-dim text-[0.75rem] mt-2">{t("updated", { date: updated })}</p>
          </header>

          {override ? (
            <article className="bg-bg-card border border-border-soft rounded-[14px] p-6 md:p-8">
              <div className="prose max-w-none text-[14px]" dangerouslySetInnerHTML={{ __html: override }} />
            </article>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6 items-start">
              {/* สารบัญ */}
              <nav className="hidden lg:block sticky top-24 bg-bg-card border border-border-soft rounded-[14px] p-4">
                <p className="text-[0.7rem] font-bold text-text-dim uppercase tracking-[0.06em] mb-2">{t("toc")}</p>
                <ul className="space-y-0.5">
                  {sections.map((s) => (
                    <li key={s.id}>
                      <a href={`#${s.id}`} className="block px-2.5 py-1.5 rounded-lg text-[0.78rem] text-text-muted hover:text-accent-light hover:bg-accent/[0.06] transition-colors">{s.title}</a>
                    </li>
                  ))}
                </ul>
              </nav>

              <div className="flex flex-col gap-4 min-w-0">
                {sections.map((s) => (
                  <section key={s.id} id={s.id} className="scroll-mt-24 bg-bg-card border border-border-soft rounded-[14px] p-6 md:p-7">
                    <h2 className="text-[1.05rem] font-extrabold mb-3">{s.title}</h2>
                    {s.paragraphs?.map((p, i) => (
                      <p key={i} className="text-[0.88rem] text-text-muted leading-[1.8] mb-3 last:mb-0">{p}</p>
                    ))}
                    {s.bullets && (
                      <ul className="flex flex-col gap-2 mt-1">
                        {s.bullets.map((b, i) => (
                          <li key={i} className="flex items-start gap-2.5 text-[0.88rem] text-text-muted leading-[1.75]">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light mt-1 shrink-0"><polyline points="20 6 9 17 4 12" /></svg>
                            {b}
                          </li>
                        ))}
                      </ul>
                    )}
                    {s.id === "contact" && (
                      <div className="flex flex-wrap gap-2.5 mt-4">
                        <a href="https://discord.gg/vCuPy8H9ub" target="_blank" rel="noopener noreferrer"
                           className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-discord hover:brightness-110 text-white text-on-accent text-[0.8rem] font-semibold transition">
                          Discord
                        </a>
                        <Link href="/contact" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border-soft text-text-muted hover:text-text-base hover:border-border-light text-[0.8rem] font-semibold transition">
                          {t("contact_page")}
                        </Link>
                      </div>
                    )}
                  </section>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
