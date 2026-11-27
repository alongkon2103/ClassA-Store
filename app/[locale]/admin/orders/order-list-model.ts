type OrderListItem = {
  id: string
  product_id: string
  status: string
  whitelist_status: string | null
  whitelisted_username: string | null
  buyer_label: string | null
  created_at: string | null
  users: { username: string; email: string | null } | null
  products: { name_th: string | null; name_en: string | null } | null
}

export const DELIVERY_STATUSES = ["pending", "whitelisted", "expired", "removed", "revoked", "suspended"] as const

export function deliveryStatusLabel(status: string | null, locale: string) {
  const labels: Record<string, [string, string]> = {
    pending: ["รอส่งมอบ", "Awaiting delivery"],
    whitelisted: ["ให้สิทธิ์แล้ว", "Access granted"],
    expired: ["สิทธิ์หมดอายุ", "Access expired"],
    removed: ["ถอนสิทธิ์แล้ว", "Access removed"],
    revoked: ["เพิกถอนสิทธิ์", "Access revoked"],
    suspended: ["ระงับสิทธิ์", "Access suspended"],
  }
  return labels[status || "pending"]?.[locale === "th" ? 0 : 1] || status || "—"
}

export type OrderFilters = {
  search: string
  product: string
  fulfillment: string
  sort: "newest" | "oldest"
}

export function filterOrders<T extends OrderListItem>(orders: T[], filters: OrderFilters): T[] {
  const query = filters.search.trim().toLocaleLowerCase()
  return orders.filter(order => {
    if (filters.product !== "all" && order.product_id !== filters.product) return false
    if (filters.fulfillment !== "all" && (order.status !== "paid" || (order.whitelist_status || "pending") !== filters.fulfillment)) return false
    return [order.id, order.whitelisted_username, order.users?.username, order.users?.email, order.buyer_label, order.products?.name_th, order.products?.name_en]
      .some(value => (value || "").toLocaleLowerCase().includes(query))
  }).sort((a, b) => {
    const difference = (Date.parse(b.created_at || "") || 0) - (Date.parse(a.created_at || "") || 0)
    return filters.sort === "oldest" ? -difference : difference
  })
}
