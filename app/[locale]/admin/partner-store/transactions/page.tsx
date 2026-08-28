import { prisma } from "@/lib/prisma"
import TransactionsClient from "./TransactionsClient"
import { setRequestLocale } from "next-intl/server"

// Partner transactions: the sales that came through OUR affiliate links, read
// from the earnings snapshot we store each sync (partner_stores.dashboard_json).
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  const stores = await prisma.partner_stores.findMany({
    orderBy: { created_at: "asc" },
    select: { id: true, display_name: true, ref_slug: true, site_url: true, last_synced_at: true, dashboard_json: true },
  })

  const safe = stores.map((s) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = (s.dashboard_json ?? {}) as any
    return {
      id: s.id,
      display_name: s.display_name,
      ref_slug: s.ref_slug,
      site_url: s.site_url,
      last_synced_at: s.last_synced_at ? s.last_synced_at.toISOString() : null,
      totals: d.totals ?? null,
      sales: Array.isArray(d.sales) ? d.sales : [],
      payouts: Array.isArray(d.payouts) ? d.payouts : [],
    }
  })

  return <TransactionsClient stores={safe} />
}
