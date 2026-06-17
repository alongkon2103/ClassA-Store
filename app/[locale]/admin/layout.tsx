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
      {/* Mobile: full-width, less padding, top padding accounts for the
          fixed mobile header (56px). Desktop: margin-left matches the
          fixed 224px sidebar. */}
      <main className="flex-1 min-w-0 w-full pt-16 px-3 pb-6 sm:px-5 lg:ml-56 lg:p-8 lg:pt-8">
        {children}
      </main>
    </div>
  )
}
