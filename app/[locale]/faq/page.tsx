import { setRequestLocale } from "next-intl/server"
import FaqClient from "./FaqClient"
import Navbar from "@/components/Navbar"
import Footer from "@/components/home/Footer"

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <FaqClient />
      </main>
      <Footer />
    </div>
  )
}
