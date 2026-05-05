"use client"

import { useState, useMemo } from "react"
import { format } from "date-fns"
import Image from "next/image"

// ── Status Badge ──────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
    const map: Record<string, string> = {
        paid: "bg-green-500/15 text-green-400",
        pending: "bg-orange-500/15 text-orange-400",
        fulfilled: "bg-accent/15 text-accent-light",
        failed: "bg-red-500/15 text-red-400",
        cancelled: "bg-red-500/15 text-red-400",
    }
    return (
        <span className={`text-[10px] px-2.5 py-1 rounded-full font-medium uppercase tracking-wider ${map[status] ?? "bg-white/10 text-text-muted"}`}>
            {status}
        </span>
    )
}

export default function OrdersClient({ orders }: { orders: any[] }) {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "pending" | "failed">("all")

  const filtered = useMemo(() => {
    return orders
      .filter((o) => statusFilter === "all" || o.status === statusFilter)
      .filter((o) =>
        o.id.toLowerCase().includes(search.toLowerCase()) ||
        o.users.username.toLowerCase().includes(search.toLowerCase()) ||
        (o.users.email ?? "").toLowerCase().includes(search.toLowerCase()) ||
        o.products.name_en.toLowerCase().includes(search.toLowerCase())
      )
  }, [orders, search, statusFilter])

  const stats = useMemo(() => ({
    total: orders.length,
    paid: orders.filter(o => o.status === 'paid').length,
    revenue: orders.filter(o => o.status === 'paid').reduce((sum, o) => sum + Number(o.amount), 0)
  }), [orders])

  return (
    <div className="space-y-8 font-body">
      {/* Header */}
      <div>
        <h1 className="text-[26px] font-bold font-display text-text-base tracking-tight">Orders</h1>
        <p className="text-text-muted text-[13px] mt-1 font-body">{orders.length} total transactions found</p>
      </div>

      {/* Stat Cards - Matching Dashboard/Keys style */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border bg-gradient-to-br from-accent/20 to-accent/5 border-accent/20 p-5">
          <p className="text-[11px] tracking-widest text-text-muted uppercase mb-3 font-body">Total Orders</p>
          <p className="text-[28px] font-bold font-display text-white leading-none">
            {stats.total}
          </p>
        </div>
        <div className="rounded-2xl border bg-gradient-to-br from-green-500/15 to-green-500/5 border-green-500/20 p-5">
          <p className="text-[11px] tracking-widest text-text-muted uppercase mb-3 font-body">Paid Orders</p>
          <p className="text-[28px] font-bold font-display text-green-400 leading-none">
            {stats.paid}
          </p>
        </div>
        <div className="rounded-2xl border bg-gradient-to-br from-purple-500/15 to-purple-500/5 border-purple-500/20 p-5">
          <p className="text-[11px] tracking-widest text-text-muted uppercase mb-3 font-body">Total Revenue</p>
          <p className="text-[28px] font-bold font-display text-accent-light leading-none">
            ฿{stats.revenue.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[200px] relative group">
            <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by ID, User, or Product..."
                className="w-full bg-bg-card border border-accent/15 rounded-xl px-4 py-3 text-[13px] placeholder:text-text-muted outline-none focus:border-accent/40 transition-all font-body"
            />
        </div>

        <div className="flex gap-1 bg-bg-card border border-accent/15 rounded-xl p-1 font-body">
          {(["all", "paid", "pending", "failed"] as const).map((f) => (
            <button key={f} onClick={() => setStatusFilter(f)}
              className={`px-4 py-1.5 rounded-lg text-[12px] font-medium transition capitalize ${
                statusFilter === f ? "bg-accent/20 text-accent-light" : "text-text-muted hover:text-text-base"
              }`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Table - Matching Admin/Dashboard style */}
      <div className="bg-bg-card border border-accent/10 rounded-2xl p-5">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] font-body">
            <thead>
              <tr className="text-left text-[11px] text-text-muted border-b border-white/5 uppercase tracking-widest">
                <th className="pb-4 font-medium">Order / Date</th>
                <th className="pb-4 font-medium">Customer</th>
                <th className="pb-4 font-medium px-4">Product</th>
                <th className="pb-4 font-medium">Amount</th>
                <th className="pb-4 font-medium">Status</th>
                <th className="pb-4 font-medium">Key</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-text-muted italic">No orders found</td>
                </tr>
              )}
              {filtered.map((o) => (
                <tr key={o.id} className="hover:bg-white/[0.02] transition-colors group">
                  {/* Order / Date */}
                  <td className="py-4">
                    <p className="font-mono text-white text-[12px] group-hover:text-accent-light transition-colors">#{o.id.slice(0, 8)}</p>
                    <p className="text-[11px] text-text-muted mt-1">
                      {o.created_at ? format(new Date(o.created_at), "dd MMM, HH:mm") : "—"}
                    </p>
                  </td>

                  {/* Customer */}
                  <td className="py-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center text-[11px] font-bold text-accent-light border border-accent/10">
                        {o.users.username.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-text-base truncate">{o.users.username}</p>
                        <p className="text-[11px] text-text-muted truncate">{o.users.email}</p>
                      </div>
                    </div>
                  </td>

                  {/* Product */}
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 relative rounded-lg overflow-hidden bg-bg-base shrink-0 border border-white/5">
                        {o.products.product_images?.[0] && (
                          <Image src={o.products.product_images[0].url} alt="" fill className="object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-text-base truncate line-clamp-1">{o.products.name_en}</p>
                        <p className="text-[11px] text-accent-light">{o.product_variants?.label_en || "Standard"}</p>
                      </div>
                    </div>
                  </td>

                  {/* Amount */}
                  <td className="py-4">
                    <span className="font-bold text-accent-light font-display text-[16px]">฿{Number(o.amount).toLocaleString()}</span>
                  </td>

                  {/* Status */}
                  <td className="py-4">
                    <StatusBadge status={o.status} />
                  </td>

                  {/* Key */}
                  <td className="py-4">
                    {o.game_keys ? (
                      <div className="flex flex-col gap-1 max-w-[120px]">
                        <span className="font-mono text-[10px] text-accent-light bg-accent/5 px-2 py-1 rounded border border-accent/15 truncate group-hover:bg-accent/10 transition-colors">
                          {o.game_keys.key_value}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[11px] text-text-muted italic opacity-40">No Key Assigned</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
