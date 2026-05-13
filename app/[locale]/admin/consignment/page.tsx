import { prisma } from "@/lib/prisma"
import { getTranslations, setRequestLocale } from "next-intl/server"

export default async function ConsignmentPage({ params }: any) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations("Consignment")

  const report = await prisma.products.findMany({
    where: { is_consignment: true },
    include: {
      product_consignments: { orderBy: { payout_share: "desc" } },
      orders: {
        where: { status: "paid" },
        select: { amount: true }
      }
    }
  })

  const processed = report.map((p) => {
    const totalOrders = p.orders.length
    const grossRevenue = p.orders.reduce((sum, o) => sum + Number(o.amount), 0)
    const commissionPct = Number(p.commission_pct ?? 0)
    const ourCommission = (grossRevenue * commissionPct) / 100
    const ownerPayoutTotal = grossRevenue - ourCommission

    return {
      id: p.id,
      name_en: p.name_en,
      name_th: p.name_th,
      commission_pct: commissionPct,
      total_orders: totalOrders,
      gross_revenue: grossRevenue,
      our_commission: ourCommission,
      owner_payout: ownerPayoutTotal,
      partners: p.product_consignments.map(c => ({
        name: c.owner_name,
        contact: c.owner_contact,
        share: Number(c.payout_share),
        payout: (ownerPayoutTotal * Number(c.payout_share)) / 100
      }))
    }
  }).sort((a, b) => b.gross_revenue - a.gross_revenue)

  const totals = processed.reduce((acc, r) => ({
    gross:      acc.gross      + r.gross_revenue,
    commission: acc.commission + r.our_commission,
    payout:     acc.payout     + r.owner_payout,
  }), { gross: 0, commission: 0, payout: 0 })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[24px] font-bold">{t("title")}</h1>
        <p className="text-text-muted text-[13px] mt-0.5">
          {t("subtitle")}
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { key: "gross_revenue",    value: totals.gross,      color: "text-text-base", sub: t("actual_sales") },
          { key: "our_commission",   value: totals.commission, color: "text-green-400", sub: t("platform_net") },
          { key: "owner_payout_due", value: totals.payout,     color: "text-orange-400", sub: t("to_be_distributed") },
        ].map(({ key, value, color, sub }) => (
          <div key={key} className="bg-bg-card border border-accent/10 rounded-2xl p-5">
            <p className="text-[11px] tracking-widest text-text-muted uppercase mb-2">{t(key)}</p>
            <p className={`text-[24px] font-bold ${color}`}>฿{value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            <p className="text-[11px] text-text-muted mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* Per Product Table */}
      <div className="bg-bg-card border border-accent/10 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] text-text-muted border-b border-white/5 bg-white/[0.02]">
                <th className="px-5 py-3.5 font-medium">{t("product")}</th>
                <th className="px-4 py-3.5 font-medium">{t("revenue_breakdown")}</th>
                <th className="px-4 py-3.5 font-medium">{t("commission_pct")}</th>
                <th className="px-4 py-3.5 font-medium text-right">{t("orders")}</th>
                <th className="px-4 py-3.5 font-medium text-right">{t("gross")}</th>
                <th className="px-4 py-3.5 font-medium text-right text-green-400">{t("we_get")}</th>
                <th className="px-4 py-3.5 font-medium text-right text-orange-400">{t("pay_owner")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {processed.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-text-muted">
                    {t("no_consignment")}
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
                    <td className="px-4 py-4 min-w-[320px]">
                      <div className="space-y-3">
                        {r.partners.length > 0 ? (
                          r.partners.map((p, i) => (
                            <div key={i} className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
                              <div className="flex justify-between items-center mb-1">
                                <span className="font-bold text-text-base">{p.name}</span>
                                <span className="text-[10px] bg-accent/10 text-accent-light px-1.5 py-0.5 rounded">{p.share}% {t("of_pool")}</span>
                              </div>
                              <div className="flex justify-between text-[12px]">
                                <span className="text-text-muted">{p.contact}</span>
                                <span className="font-mono font-bold text-orange-400">฿{p.payout.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-text-muted italic text-[12px]">{t("no_partners")}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-accent-light font-bold">
                      {r.commission_pct}%
                    </td>
                    <td className="px-4 py-4 text-right text-text-muted font-mono">{r.total_orders}</td>
                    <td className="px-4 py-4 text-right font-mono">฿{r.gross_revenue.toLocaleString()}</td>
                    <td className="px-4 py-4 text-right font-bold text-green-400 font-mono">
                      ฿{r.our_commission.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-4 text-right font-bold text-orange-400 font-mono">
                      ฿{r.owner_payout.toLocaleString(undefined, { minimumFractionDigits: 2 })}
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