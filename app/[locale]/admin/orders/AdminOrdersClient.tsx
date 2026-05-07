"use client"

import { useState, useMemo } from "react"
import { format } from "date-fns"

export default function AdminOrdersClient({ orders }: { orders: any[] }) {
  const [search,        setSearch]        = useState("")
  const [statusFilter,  setStatusFilter]  = useState("all")
  const [wlFilter,      setWlFilter]      = useState("all")
  const [updating,      setUpdating]      = useState<string | null>(null)

  const filtered = useMemo(() => {
    return orders
      .filter((o) => statusFilter === "all" || o.status === statusFilter)
      .filter((o) => wlFilter    === "all" || o.whitelist_status === wlFilter)
      .filter((o) => {
        const q = search.toLowerCase()
        return (
          (o.whitelisted_username ?? "").toLowerCase().includes(q) ||
          (o.users?.username      ?? "").toLowerCase().includes(q) ||
          (o.products?.name_en    ?? "").toLowerCase().includes(q)
        )
      })
  }, [orders, search, statusFilter, wlFilter])

  const handleWhitelistStatus = async (id: string, whitelist_status: string) => {
    setUpdating(id)
    await fetch(`/api/admin/orders/${id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ whitelist_status }),
    })
    setUpdating(null)
    window.location.reload()
  }

  const pendingWl = orders.filter(
    (o) => o.status === "paid" && o.whitelist_status === "pending"
  ).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-bold">Orders</h1>
          <p className="text-text-muted text-[13px] mt-0.5">{orders.length} total</p>
        </div>
        {pendingWl > 0 && (
          <div className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-xl px-4 py-2.5">
            <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
            <span className="text-[13px] text-orange-400 font-medium">
              {pendingWl} pending whitelist
            </span>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search username, user, product..."
          className="flex-1 min-w-[200px] bg-bg-card border border-accent/15 rounded-xl px-4 py-2.5 text-[13px] placeholder:text-text-muted outline-none focus:border-accent/40"
        />
        <div className="flex gap-1 bg-bg-card border border-accent/15 rounded-xl p-1">
          {["all", "paid", "pending", "expired"].map((f) => (
            <button key={f} onClick={() => setStatusFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition capitalize ${
                statusFilter === f ? "bg-accent/20 text-accent-light" : "text-text-muted hover:text-text-base"
              }`}>
              {f}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-bg-card border border-accent/15 rounded-xl p-1">
          {["all", "pending", "whitelisted", "removed"].map((f) => (
            <button key={f} onClick={() => setWlFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition capitalize ${
                wlFilter === f ? "bg-orange-500/20 text-orange-400" : "text-text-muted hover:text-text-base"
              }`}>
              {f === "all" ? "All WL" : f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-bg-card border border-accent/10 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] text-text-muted border-b border-white/5 bg-white/[0.02]">
                <th className="px-5 py-3.5 font-medium">User</th>
                <th className="px-4 py-3.5 font-medium">Product</th>
                <th className="px-4 py-3.5 font-medium">In-Game Username</th>
                <th className="px-4 py-3.5 font-medium">Amount</th>
                <th className="px-4 py-3.5 font-medium">Payment</th>
                <th className="px-4 py-3.5 font-medium">Order Status</th>
                <th className="px-4 py-3.5 font-medium">Whitelist</th>
                <th className="px-4 py-3.5 font-medium">Date</th>
                <th className="px-4 py-3.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-text-muted">
                    No orders found
                  </td>
                </tr>
              )}
              {filtered.map((o) => (
                <tr key={o.id} className="hover:bg-white/[0.02] transition">
                  {/* User */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      {o.users?.avatar ? (
                        <img src={o.users.avatar} className="w-6 h-6 rounded-full object-cover" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center text-[10px]">
                          {o.users?.username?.[0]?.toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p>{o.users?.username ?? "—"}</p>
                        <p className="text-[11px] text-text-muted">{o.users?.email ?? ""}</p>
                      </div>
                    </div>
                  </td>

                  {/* Product */}
                  <td className="px-4 py-4">
                    <p className="text-text-base">{o.products?.name_en ?? "—"}</p>
                    <p className="text-[11px] text-text-muted">{o.product_variants?.label_en ?? ""}</p>
                  </td>

                  {/* In-Game Username */}
                  <td className="px-4 py-4">
                    {o.whitelisted_username ? (
                      <span className="font-mono text-[13px] bg-bg-base px-2 py-1 rounded-lg text-accent-light">
                        {o.whitelisted_username}
                      </span>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </td>

                  {/* Amount */}
                  <td className="px-4 py-4 font-semibold text-accent-light">
                    ฿{o.amount.toLocaleString()}
                  </td>

                  {/* Payment Method */}
                  <td className="px-4 py-4">
                    <span className="text-[11px] px-2 py-0.5 rounded-full capitalize"
                      style={{
                        background: o.payment_method === "promptpay" ? "rgba(27,167,225,.15)" : "rgba(103,114,229,.15)",
                        color:      o.payment_method === "promptpay" ? "#1ba7e1" : "#6772e5",
                      }}>
                      {o.payment_method === "promptpay" ? "PromptPay" : "Card"}
                    </span>
                  </td>

                  {/* Order Status */}
                  <td className="px-4 py-4">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                      o.status === "paid"    ? "bg-green-500/15 text-green-400"   :
                      o.status === "pending" ? "bg-orange-500/15 text-orange-400" :
                      o.status === "expired" ? "bg-red-500/15 text-red-400"       :
                      "bg-white/5 text-text-muted"
                    }`}>
                      {o.status}
                    </span>
                  </td>

                  {/* Whitelist Status */}
                  <td className="px-4 py-4">
                    {o.status === "paid" ? (
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                        o.whitelist_status === "whitelisted" ? "bg-green-500/15 text-green-400"   :
                        o.whitelist_status === "removed"     ? "bg-red-500/15 text-red-400"       :
                        "bg-orange-500/15 text-orange-400"
                      }`}>
                        {o.whitelist_status ?? "pending"}
                      </span>
                    ) : (
                      <span className="text-text-muted text-[11px]">—</span>
                    )}
                  </td>

                  {/* Date */}
                  <td className="px-4 py-4 text-text-muted whitespace-nowrap text-[12px]">
                    {o.created_at ? format(new Date(o.created_at), "dd MMM HH:mm") : "—"}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-4">
                    {o.status === "paid" && (
                      <div className="flex flex-col gap-1.5">
                        {o.whitelist_status !== "whitelisted" && (
                          <button
                            onClick={() => handleWhitelistStatus(o.id, "whitelisted")}
                            disabled={updating === o.id}
                            className="text-[11px] px-3 py-1.5 rounded-lg bg-green-500/15 text-green-400 hover:bg-green-500/25 transition disabled:opacity-40 whitespace-nowrap"
                          >
                            {updating === o.id ? "..." : "Whitelist"}
                          </button>
                        )}
                        {o.whitelist_status === "whitelisted" && (
                          <button
                            onClick={() => handleWhitelistStatus(o.id, "removed")}
                            disabled={updating === o.id}
                            className="text-[11px] px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 transition disabled:opacity-40 whitespace-nowrap"
                          >
                            {updating === o.id ? "..." : "Remove"}
                          </button>
                        )}
                        {o.whitelist_status === "removed" && (
                          <button
                            onClick={() => handleWhitelistStatus(o.id, "whitelisted")}
                            disabled={updating === o.id}
                            className="text-[11px] px-3 py-1.5 rounded-lg bg-green-500/15 text-green-400 hover:bg-green-500/25 transition disabled:opacity-40 whitespace-nowrap"
                          >
                            {updating === o.id ? "..." : "Re-whitelist"}
                          </button>
                        )}
                      </div>
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