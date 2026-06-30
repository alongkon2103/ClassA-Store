import Link from "next/link"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { setRequestLocale, getTranslations } from "next-intl/server"
import { getFeatureFlags } from "@/lib/featureFlags"
import { getImageUrl } from "@/lib/getImageUrl"
import Navbar from "@/components/Navbar"
import Footer from "@/components/home/Footer"

// Public LiveGen picker. No auth required to view — anyone can browse the list
// of games and open the builder. Login is only enforced on save (handled inside
// LiveGenClient + the drafts API).

export const dynamic = "force-dynamic"

export default async function LiveGenPickerPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const flags = await getFeatureFlags()
  if (!flags.livegen_enabled) notFound()

  const t = await getTranslations("LiveGen")

  // Live-ready products only — without any product_functions there's nothing
  // for the builder to render, so showing them in the picker is misleading.
  const products = await prisma.products.findMany({
    where: {
      is_active: true,
      product_functions: { some: {} },
    },
    select: {
      id: true,
      slug: true,
      name_th: true,
      name_en: true,
      product_images: {
        orderBy: { sort_order: "asc" },
        take: 1,
        select: { url: true },
      },
      _count: { select: { product_functions: true } },
    },
    orderBy: [{ is_featured: "desc" }, { created_at: "desc" }],
  })

  return (
    <div className="min-h-screen bg-bg-base flex flex-col">
      <Navbar />

      <main className="flex-1 relative">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-accent/5 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2" />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-8 md:py-16">
          <header className="mb-8 md:mb-10">
            <div className="flex items-center gap-2 text-accent-light text-[10px] md:text-[11px] font-bold uppercase tracking-[0.2em] mb-2">
              <span className="w-6 md:w-8 h-[2px] bg-accent/40" />
              {t("picker_eyebrow")}
            </div>
            <h1 className="text-3xl md:text-4xl font-display font-bold text-text-base mb-2">
              {t("picker_title")}
            </h1>
            <p className="text-text-muted text-[13px] md:text-[14px] max-w-2xl">
              {t("picker_subtitle")}
            </p>
          </header>

          {products.length === 0 ? (
            <div className="bg-bg-card border border-accent/10 rounded-3xl p-10 md:p-16 text-center">
              <p className="text-text-muted text-[13px]">{t("picker_empty")}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {products.map((p) => {
                const name = locale === "th" ? p.name_th : p.name_en
                const img = p.product_images[0]?.url
                return (
                  <Link
                    key={p.id}
                    href={`/${locale}/livegen/${p.id}`}
                    className="group bg-bg-card border border-accent/10 hover:border-accent/30 rounded-2xl overflow-hidden transition-all hover:-translate-y-0.5 no-underline"
                  >
                    <div className="aspect-square relative bg-white/[0.02] overflow-hidden">
                      {img ? (
                        // Use plain <img> + getImageUrl so the same
                        // NEXT_PUBLIC_BASE_URL_IMG prefix logic kicks in as the
                        // rest of the storefront — `next/image` would point at
                        // the wrong origin in production.
                        <img
                          src={getImageUrl(img)}
                          alt={name}
                          loading="lazy"
                          className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-text-muted text-[11px]">
                          —
                        </div>
                      )}
                    </div>
                    <div className="p-3.5">
                      <p className="font-bold text-text-base text-[14px] truncate">
                        {name}
                      </p>
                      <p className="text-[11px] text-text-muted mt-0.5">
                        {t("picker_function_count", {
                          count: p._count.product_functions,
                        })}
                      </p>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
