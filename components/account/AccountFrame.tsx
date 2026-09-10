// โครงหน้าเต็ม (Navbar + พื้นหลัง + AccountShell + Footer) ให้ทุกหน้าในกลุ่มบัญชีใช้ร่วมกัน
// ดึงยอด AC Points ของผู้ใช้มาโชว์บนการ์ดใน sidebar — ระหว่างนั้นกวาดออเดอร์ที่จ่ายแล้วแต่ยังไม่ได้แต้มให้ด้วย (safety net)
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getPointsSummary } from "@/lib/points"
import Navbar from "@/components/Navbar"
import Footer from "@/components/home/Footer"
import AccountShell, { type AccountSection } from "./AccountShell"

export default async function AccountFrame({ active, children }: { active: AccountSection; children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  const summary = session?.user?.id ? await getPointsSummary(session.user.id, { entries: 0 }).catch(() => null) : null
  const points = summary ? { balance: summary.balance, active: summary.active } : null

  return (
    <div className="min-h-screen bg-bg-base flex flex-col selection:bg-accent/30 selection:text-accent-light">
      <Navbar />
      <main className="flex-1 relative">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-accent/5 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2" />
        </div>
        <div className="relative z-10 page-container py-8 md:py-12">
          <AccountShell active={active} points={points}>{children}</AccountShell>
        </div>
      </main>
      <Footer />
    </div>
  )
}
