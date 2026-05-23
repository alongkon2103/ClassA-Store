// app/admin/layout.tsx
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "@/i18n/routing"
import AdminNav from "@/components/admin/AdminNav"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)

  if (!session || !["admin", "partnership"].includes(session.user.role)) {
    redirect({ href: "/", locale: "th" }) 
  }

  return (
    <div className="min-h-screen bg-bg-base flex">
      <AdminNav />
      <main className="flex-1 ml-56 p-8">
        {children}
      </main>
    </div>
  )
}
