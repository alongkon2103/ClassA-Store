import { prisma } from "@/lib/prisma"
import { getTranslations, setRequestLocale } from "next-intl/server"

export default async function ConsignmentPage({ params }: any) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations("Consignment")

  const rawReport = await prisma.$queryRaw<any[]>`
    SELECT
      p.id,
      p.name_en,
      p.name_th,
      p.owner_name,
      p.owner_contact,
      p.commission_pct,
      COUNT(o.id)::int                                          AS total_orders,
      SUM(o.amount)::float                                      AS gross_revenue,
      SUM(o.amount * p.commission_pct / 100)::float             AS our_commission,
      SUM(o.amount * (100 - p.commission_pct) / 100)::float     AS owner_payout
    FROM products p
    LEFT JOIN orders o ON o.product_id = p.id AND o.status = 'paid'
    WHERE p.is_consignment = true
    GROUP BY p.id, p.name_en, p.name_th, p.owner_name, p.owner_contact, p.commission_pct
    ORDER BY gross_revenue DESC NULLS LAST
  `

  // ✅ convert Decimal ทุก field
  const report = rawReport.map((r) => ({
    ...r,
    commission_pct: Number(r.commission_pct ?? 0),
    gross_revenue:  Number(r.gross_revenue  ?? 0),
    our_commission: Number(r.our_commission ?? 0),
    owner_payout:   Number(r.owner_payout   ?? 0),
    total_orders:   Number(r.total_orders   ?? 0),
  }))

  const totals = report.reduce((acc, r) => ({
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
      <div className="grid grid-cols-3 gap-4">
        {[
          { key: "gross_revenue",    value: totals.gross,      color: "text-text-base" },
          { key: "our_commission",   value: totals.commission, color: "text-green-400" },
          { key: "owner_payout_due", value: totals.payout,     color: "text-orange-400" },
        ].map(({ key, value, color }) => (
          <div key={key} className="bg-bg-card border border-accent/10 rounded-2xl p-5">
            <p className="text-[11px] tracking-widest text-text-muted uppercase mb-2">{t(key)}</p>
            <p className={`text-[24px] font-bold ${color}`}>฿{value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Per Product Table */}
      <div className="bg-bg-card border border-accent/10 rounded-2xl overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-[11px] text-text-muted border-b border-white/5 bg-white/[0.02]">
              <th className="px-5 py-3.5 font-medium">{t("product")}</th>
              <th className="px-4 py-3.5 font-medium">{t("owner")}</th>
              <th className="px-4 py-3.5 font-medium">{t("commission_pct")}</th>
              <th className="px-4 py-3.5 font-medium">{t("orders")}</th>
              <th className="px-4 py-3.5 font-medium">{t("gross")}</th>
              <th className="px-4 py-3.5 font-medium text-green-400">{t("we_get")}</th>
              <th className="px-4 py-3.5 font-medium text-orange-400">{t("pay_owner")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {report.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-text-muted">
                  {t("no_consignment")}
                </td>
              </tr>
            ) : (
              report.map((r) => (
                <tr key={r.id} className="hover:bg-white/[0.02] transition">
                  <td className="px-5 py-4 font-medium">{locale === "th" ? r.name_th : r.name_en}</td>
                  <td className="px-4 py-4">
                    <p className="text-text-base">{r.owner_name ?? "—"}</p>
                    <p className="text-[11px] text-text-muted">{r.owner_contact ?? ""}</p>
                  </td>
                  <td className="px-4 py-4 text-accent-light font-semibold">
                    {r.commission_pct}%
                  </td>
                  <td className="px-4 py-4 text-text-muted">{r.total_orders}</td>
                  <td className="px-4 py-4">฿{r.gross_revenue.toLocaleString()}</td>
                  <td className="px-4 py-4 font-semibold text-green-400">
                    ฿{r.our_commission.toLocaleString()}
                  </td>
                  <td className="px-4 py-4 font-semibold text-orange-400">
                    ฿{r.owner_payout.toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}