import { setRequestLocale, getTranslations } from "next-intl/server"
import Navbar from "@/components/Navbar"
import Footer from "@/components/home/Footer"
import { prisma } from "@/lib/prisma"

export const revalidate = 60

export default async function RulesPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations("Rules")

  const key = locale === "th" ? "rules_th" : "rules_en"
  const row = await prisma.system_configs.findUnique({ where: { key } })
  const content = (row?.value ?? "").trim()

  return (
    <div className="min-h-screen bg-bg-base flex flex-col selection:bg-accent/30 selection:text-accent-light">
      <Navbar />

      <main className="flex-1 relative">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-accent/5 rounded-full blur-[120px] -translate-y-1/2 -translate-x-1/2" />
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

          <article className="bg-bg-card border border-accent/15 rounded-2xl p-6 md:p-8">
            {content ? (
              <div
                className="prose max-w-none text-[14px]"
                dangerouslySetInnerHTML={{ __html: content }}
              />
            ) : (
              <p className="text-[13px] text-text-muted italic">{t("empty")}</p>
            )}
          </article>
        </div>
      </main>

      <Footer />
    </div>
  )
}
