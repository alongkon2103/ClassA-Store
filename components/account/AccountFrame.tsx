// โครงหน้าเต็ม (Navbar + พื้นหลัง + AccountShell + Footer) ให้ทุกหน้าในกลุ่มบัญชีใช้ร่วมกัน
import Navbar from "@/components/Navbar"
import Footer from "@/components/home/Footer"
import AccountShell, { type AccountSection } from "./AccountShell"

export default function AccountFrame({ active, children }: { active: AccountSection; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg-base flex flex-col selection:bg-accent/30 selection:text-accent-light">
      <Navbar />
      <main className="flex-1 relative">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-accent/5 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2" />
        </div>
        <div className="relative z-10 page-container py-8 md:py-12">
          <AccountShell active={active}>{children}</AccountShell>
        </div>
      </main>
      <Footer />
    </div>
  )
}
