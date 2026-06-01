import { prisma } from "@/lib/prisma"
import { setRequestLocale } from "next-intl/server"
import { Monitor, Users, ShieldCheck, Megaphone, Activity } from "lucide-react"
import { format } from "date-fns"
import { useTranslations } from "next-intl"

export default async function AdminDesktopOverviewPage({
  params
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  
  const [totalUsers, onlineUsers, hwidLocked, totalAnnouncements, recentActivity] = await Promise.all([
    prisma.users.count(),
    prisma.users.count({ where: { isOnlineDesktop: true } }),
    prisma.users.count({ where: { hwid: { not: null } } }),
    prisma.announcements.count(),
    prisma.users.findMany({
      where: { lastSeen: { not: null } },
      orderBy: { lastSeen: "desc" },
      take: 5,
      select: {
        username: true,
        lastSeen: true,
        isOnlineDesktop: true,
        avatar: true
      }
    })
  ])

  const stats = [
    { label: "Active Users", value: onlineUsers, icon: Activity, color: "text-green-400", bg: "bg-green-500/10" },
    { label: "HWID Bound", value: hwidLocked, icon: ShieldCheck, color: "text-blue-400", bg: "bg-blue-500/10" },
    { label: "Total Users", value: totalUsers, icon: Users, color: "text-accent-light", bg: "bg-accent/10" },
    { label: "Announcements", value: totalAnnouncements, icon: Megaphone, color: "text-purple-400", bg: "bg-purple-500/10" },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-[26px] font-bold flex items-center gap-3">
          <Monitor className="text-accent" size={28} />
          Desktop Program Overview
        </h1>
        <p className="text-text-muted text-[14px] mt-1">Monitor your desktop application ecosystem and user activity.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-bg-card border border-accent/10 p-6 rounded-3xl shadow-sm hover:border-accent/30 transition-all group">
            <div className="flex items-center justify-between mb-4">
              <div className={`w-12 h-12 ${stat.bg} ${stat.color} rounded-2xl flex items-center justify-center shadow-inner`}>
                <stat.icon size={24} />
              </div>
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Live Data</span>
            </div>
            <p className="text-[12px] font-bold text-text-muted uppercase tracking-wider mb-1">{stat.label}</p>
            <p className="text-[32px] font-black">{stat.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Recent Activity & Quick Actions */}
      <div className="grid grid-cols-1">
        {/* Recent Connections */}
        <div className="lg:col-span-2 bg-bg-card border border-accent/10 rounded-3xl overflow-hidden flex flex-col">
          <div className="px-6 py-5 border-b border-accent/10 flex items-center justify-between bg-white/[0.01]">
            <h3 className="font-bold text-[15px] flex items-center gap-2">
              <Activity size={18} className="text-green-400" />
              Recent Connections
            </h3>
          </div>
          <div className="flex-1">
            {recentActivity.map((u, i) => (
              <div key={i} className="px-6 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors border-b border-white/5 last:border-0">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    {u.avatar ? (
                      <img src={u.avatar} className="w-10 h-10 rounded-full border border-white/10" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center font-bold text-accent-light text-sm">
                        {u.username[0].toUpperCase()}
                      </div>
                    )}
                    {u.isOnlineDesktop && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-bg-card rounded-full" />
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-[14px]">{u.username}</p>
                    <p className="text-[11px] text-text-muted">
                      {u.isOnlineDesktop ? "Currently Online" : `Last seen ${format(new Date(u.lastSeen!), "HH:mm")}`}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                   <p className="text-[11px] font-bold text-text-muted uppercase tracking-tighter">
                     {format(new Date(u.lastSeen!), "dd MMM yyyy")}
                   </p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
