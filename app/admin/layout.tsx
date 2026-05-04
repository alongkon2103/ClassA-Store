// app/admin/layout.tsx
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import AdminNav from "@/components/admin/AdminNav"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== "admin") redirect("/")

  return (
    <div className="min-h-screen bg-bg-base flex">
      <AdminNav />
      <main className="flex-1 ml-56 p-8">
        {children}
      </main>
    </div>
  )
}