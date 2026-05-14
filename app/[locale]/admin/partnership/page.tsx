import { prisma } from "@/lib/prisma"
import { getTranslations, setRequestLocale } from "next-intl/server"

export default async function PartnershipEarningsPage({ params }: any) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations("Partnership") // We might need to add translations or use fallback

  const products = await prisma.products.findMany({
    where: { is_consignment: false },
    include: {
      product_shares: {
        include: { partners: true }
      },
      orders: {
        where: { status: "paid" },
        select: { amount: true }
      }
    }
  })

  const processed = products.map((p) => {
    const totalOrders = p.orders.length
    const grossRevenue = p.orders.reduce((sum, o) => sum + Number(o.amount), 0)
    
    return {
      id: p.id,
      name_en: p.name_en,
      name_th: p.name_th,
      total_orders: totalOrders,
      gross_revenue: grossRevenue,
      partners: p.product_shares.map(s => ({
        name: s.partners.name,
        contact: s.partners.contact,
        share: Number(s.share_pct),
        payout: (grossRevenue * Number(s.share_pct)) / 100
      }))
    }
  }).filter(p => p.partners.length > 0)
    .sort((a, b) => b.gross_revenue - a.gross_revenue)

  const totalGross = processed.reduce((acc, r) => acc + r.gross_revenue, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[24px] font-bold">{t("title")}</h1>
        <p className="text-text-muted text-[13px] mt-0.5">
          {t("subtitle")}
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-bg-card border border-accent/10 rounded-2xl p-5">
          <p className="text-[11px] tracking-widest text-text-muted uppercase mb-2">{t("total_gross")}</p>
          <p className="text-[24px] font-bold text-text-base">฿{totalGross.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          <p className="text-[11px] text-text-muted mt-1">{t("total_gross_desc")}</p>
        </div>
        <div className="bg-bg-card border border-accent/10 rounded-2xl p-5">
          <p className="text-[11px] tracking-widest text-text-muted uppercase mb-2">{t("active_partners")}</p>
          <p className="text-[24px] font-bold text-accent-light">{processed.length} {t("active_partners_desc")}</p>
          <p className="text-[11px] text-text-muted mt-1">{t("active_partners_desc")}</p>
        </div>
      </div>

      {/* Per Product Table */}
      <div className="bg-bg-card border border-accent/10 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] text-text-muted border-b border-white/5 bg-white/[0.02]">
                <th className="px-5 py-3.5 font-medium">{t("product")}</th>
                <th className="px-4 py-3.5 font-medium">{t("shares_payouts")}</th>
                <th className="px-4 py-3.5 font-medium text-right">{t("orders")}</th>
                <th className="px-4 py-3.5 font-medium text-right font-bold">{t("gross_revenue")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {processed.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-text-muted">
                    {t("no_partnership")}
                  </td>
                </tr>
              ) : (
                processed.map((r) => (
                  <tr key={r.id} className="hover:bg-white/[0.02] transition align-top">
                    <td className="px-5 py-4 font-medium">
                      <div className="flex flex-col gap-1">
                        <span>{locale === "th" ? r.name_th : r.name_en}</span>
                        <span className="text-[10px] text-text-muted font-mono">{r.id}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 min-w-[350px]">
                      <div className="space-y-2">
                        {r.partners.map((p, i) => (
                          <div key={i} className="bg-white/[0.02] border border-white/5 rounded-xl p-3 flex justify-between items-center">
                            <div>
                              <p className="font-bold text-text-base">{p.name}</p>
                              <p className="text-[11px] text-text-muted">{p.contact}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] bg-accent/10 text-accent-light px-1.5 py-0.5 rounded inline-block mb-1">{p.share}%</p>
                              <p className="font-mono font-bold text-green-400 text-[14px]">฿{p.payout.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right text-text-muted font-mono">{r.total_orders}</td>
                    <td className="px-4 py-4 text-right font-mono font-bold text-[14px]">
                      ฿{r.gross_revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
