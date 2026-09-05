import "../globals.css"
import Providers from "@/components/home/Providers"
import PageTracker from "@/components/PageTracker"
import { Inter, Noto_Sans_Thai } from "next/font/google"
import { NextIntlClientProvider } from "next-intl"
import { getMessages, setRequestLocale } from "next-intl/server"
import { routing } from "@/i18n/routing"
import { notFound } from "next/navigation"
import { Metadata } from "next" // 1. เพิ่มตัวนี้เข้าไป

// 2. วาง Metadata ไว้ตรงนี้ (นอก function RootLayout)
export const metadata: Metadata = {
  title: 'A-Class Store | Premium Roblox Maps & Secure Whitelist Systems',
  description: 'High-quality Roblox maps with advanced anti-copy whitelist protection. Secure your assets and manage licenses effortlessly via our dashboard.',
  openGraph: {
    title: 'A-Class Store - Premium Roblox Maps & Secure Whitelist',
    description: 'Get exclusive access to top-tier Roblox maps. Buy your whitelist license today for instant, secure, and permanent access to our premium creations.',
    url: 'https://aclassstore.com',
    siteName: 'A-Class Store',
    images: [
      {
        url: 'https://aclassstore.com/uploads/AClassStore.png', 
        width: 1200,
        height: 630,
        alt: 'A-Class Store Whitelist System',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'A-Class Store | Secure Roblox Asset Marketplace',
    description: 'Stop map leaks today. Professional Whitelist systems and premium assets for Roblox developers.',
    images: ['https://aclassstore.com/uploads/AClassStore.png'],
  },
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