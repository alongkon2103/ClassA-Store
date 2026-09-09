import "../globals.css"
import Providers from "@/components/home/Providers"
import PageTracker from "@/components/PageTracker"
import { Inter, Noto_Sans_Thai } from "next/font/google"
import { NextIntlClientProvider } from "next-intl"
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server"
import { routing } from "@/i18n/routing"
import { OG_LOCALES } from "@/lib/i18n/locale"
import { notFound } from "next/navigation"
import { Metadata } from "next" // 1. เพิ่มตัวนี้เข้าไป

// metadata ของทั้งเว็บตามภาษาที่เปิด (messages → Meta) — og:locale เปลี่ยนตามภาษา
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "Meta" })
  const image = { url: "https://aclassstore.com/uploads/AClassStore.png", width: 1200, height: 630, alt: t("og_image_alt") }
  return {
    title: t("title"),
    description: t("description"),
    openGraph: {
      title: t("og_title"),
      description: t("og_description"),
      url: "https://aclassstore.com",
      siteName: "A-Class Store",
      images: [image],
      locale: OG_LOCALES[locale] ?? "en_US",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: t("twitter_title"),
      description: t("twitter_description"),
      images: [image.url],
    },
  }
}

// ดีไซน์ใหม่ใช้ Inter คู่กับ Noto Sans Thai ทั้งเว็บ (ไม่แยก display/body)
// ตัวแปร --font-display / --font-body ยังคงชื่อเดิมใน globals.css เพราะ
// component เก่าอ้างถึงอยู่ — แค่ชี้ไปที่ฟอนต์คู่ใหม่แทน
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-sans",
})

const notoThai = Noto_Sans_Thai({
  subsets: ["thai"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-thai",
})

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound()
  }

  setRequestLocale(locale)
  const messages = await getMessages()

  return (
    <html
      lang={locale}
      className={`${inter.variable} ${notoThai.variable}`}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <NextIntlClientProvider messages={messages}>
          <Providers>
            <PageTracker />
            {children}
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}