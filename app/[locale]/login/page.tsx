import type { Metadata } from "next"
import { setRequestLocale } from "next-intl/server"
import Navbar from "@/components/Navbar"
import Footer from "@/components/home/Footer"
import LoginCard from "@/components/login/LoginCard"

// หน้าเข้าสู่ระบบตามดีไซน์ใหม่ — ใช้ navbar/footer ชุดเดียวกับทุกหน้า การ์ดอยู่กลางจอ
export const metadata: Metadata = {
  title: "เข้าสู่ระบบ — A Class Store",
  description: "Sign in to A Class Store with Discord or Google",
}

export default async function LoginPage({ params, searchParams }: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ callbackUrl?: string }>
}) {
  const { locale } = await params
  const { callbackUrl } = await searchParams
  setRequestLocale(locale)

  return (
    <div className="min-h-screen bg-bg-base flex flex-col">
      <Navbar />
      <main className="flex-1 relative flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-accent/5 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-accent/5 rounded-full blur-[120px] translate-y-1/2 -translate-x-1/2" />
        </div>
        <div className="page-container relative z-10 flex justify-center py-10 md:py-16">
          <LoginCard callbackUrl={callbackUrl ?? "/"} />
        </div>
      </main>
      <Footer />
    </div>
  )
}
