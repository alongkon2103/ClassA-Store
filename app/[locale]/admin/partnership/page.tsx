// import { prisma } from "@/lib/prisma"
// import { getTranslations, setRequestLocale } from "next-intl/server"

// export default async function PartnershipEarningsPage({ params }: any) {
//   const { locale } = await params
//   setRequestLocale(locale)
//   const t = await getTranslations("Partnership") // We might need to add translations or use fallback

//   const products = await prisma.products.findMany({
//     where: { is_consignment: false },
//     include: {
//       product_shares: {
//         include: { partners: true }
//       },
//       orders: {
//         where: { status: "paid" },
//         select: { amount: true }
//       }
//     }
//   })

//   const processed = products.map((p) => {
//     const totalOrders = p.orders.length
//     const grossRevenue = p.orders.reduce((sum, o) => sum + Number(o.amount), 0)

//     return {
//       id: p.id,
//       name_en: p.name_en,
//       name_th: p.name_th,
//       total_orders: totalOrders,
//       gross_revenue: grossRevenue,
//       partners: p.product_shares.map(s => ({
//         name: s.partners.name,
//         contact: s.partners.contact,
//         share: Number(s.share_pct),
//         payout: (grossRevenue * Number(s.share_pct)) / 100
//       }))
//     }
//   }).filter(p => p.partners.length > 0)
//     .sort((a, b) => b.gross_revenue - a.gross_revenue)

//   const totalGross = processed.reduce((acc, r) => acc + r.gross_revenue, 0)

//   return (
//     <div className="space-y-6">
//       <div>
//         <h1 className="text-[24px] font-bold">{t("title")}</h1>
//         <p className="text-text-muted text-[13px] mt-0.5">
//           {t("subtitle")}
//         </p>
//       </div>

//       {/* Summary */}
//       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//         <div className="bg-bg-card border border-accent/10 rounded-2xl p-5">
//           <p className="text-[11px] tracking-widest text-text-muted uppercase mb-2">{t("total_gross")}</p>
//           <p className="text-[24px] font-bold text-text-base">฿{totalGross.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
//           <p className="text-[11px] text-text-muted mt-1">{t("total_gross_desc")}</p>
//         </div>
//         <div className="bg-bg-card border border-accent/10 rounded-2xl p-5">
//           <p className="text-[11px] tracking-widest text-text-muted uppercase mb-2">{t("active_partners")}</p>
//           <p className="text-[24px] font-bold text-accent-light">{processed.length} {t("active_partners_desc")}</p>
//           <p className="text-[11px] text-text-muted mt-1">{t("active_partners_desc")}</p>
//         </div>
//       </div>

//       {/* Per Product Table */}
//       <div className="bg-bg-card border border-accent/10 rounded-2xl overflow-hidden">
//         <div className="overflow-x-auto">
//           <table className="w-full text-[13px]">
//             <thead>
//               <tr className="text-left text-[11px] text-text-muted border-b border-white/5 bg-white/[0.02]">
//                 <th className="px-5 py-3.5 font-medium">{t("product")}</th>
//                 <th className="px-4 py-3.5 font-medium">{t("shares_payouts")}</th>
//                 <th className="px-4 py-3.5 font-medium text-right">{t("orders")}</th>
//                 <th className="px-4 py-3.5 font-medium text-right font-bold">{t("gross_revenue")}</th>
//               </tr>
//             </thead>
//             <tbody className="divide-y divide-white/5">
//               {processed.length === 0 ? (
//                 <tr>
//                   <td colSpan={4} className="text-center py-12 text-text-muted">
//                     {t("no_partnership")}
//                   </td>
//                 </tr>
//               ) : (
//                 processed.map((r) => (
//                   <tr key={r.id} className="hover:bg-white/[0.02] transition align-top">
//                     <td className="px-5 py-4 font-medium">
//                       <div className="flex flex-col gap-1">
//                         <span>{locale === "th" ? r.name_th : r.name_en}</span>
//                         <span className="text-[10px] text-text-muted font-mono">{r.id}</span>
//                       </div>
//                     </td>
//                     <td className="px-4 py-4 min-w-[350px]">
//                       <div className="space-y-2">
//                         {r.partners.map((p, i) => (
//                           <div key={i} className="bg-white/[0.02] border border-white/5 rounded-xl p-3 flex justify-between items-center">
//                             <div>
//                               <p className="font-bold text-text-base">{p.name}</p>
//                               <p className="text-[11px] text-text-muted">{p.contact}</p>
//                             </div>
//                             <div className="text-right">
//                               <p className="text-[10px] bg-accent/10 text-accent-light px-1.5 py-0.5 rounded inline-block mb-1">{p.share}%</p>
//                               <p className="font-mono font-bold text-green-400 text-[14px]">฿{p.payout.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
//                             </div>
//                           </div>
//                         ))}
//                       </div>
//                     </td>
//                     <td className="px-4 py-4 text-right text-text-muted font-mono">{r.total_orders}</td>
//                     <td className="px-4 py-4 text-right font-mono font-bold text-[14px]">
//                       ฿{r.gross_revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
//                     </td>
//                   </tr>
//                 ))
//               )}
//             </tbody>
//           </table>
//         </div>
//       </div>
//     </div>
//   )
// }

"use client"
import { Fragment, useEffect, useState } from "react"
import { useTranslations, useLocale } from "next-intl"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { PAYPAL_FEE_PCT, PAYPAL_FIXED_FEE_USD } from "@/lib/paypalSettlement"

type Partner = { name: string; contact: string; share: number; payout: number; payout_net?: number }
type ProductRow = {
  id: string; name_en: string; name_th: string;
  total_orders: number; gross_revenue: number; net_revenue?: number;
  manual_orders?: number; manual_revenue?: number;
  paypal_orders?: number; paypal_revenue?: number;
  paypal_amount_usd?: number; paypal_net_usd?: number; paypal_net_thb?: number;
  partners: Partner[]
}

function getLast12Months() {
  const months = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleString('th-TH', { month: 'long', year: 'numeric' })
    months.push({ value, label })
  }
  return months
}

const COLORS = ["#7c6af7", "#a78bfa", "#c4b5fd", "#6d28d9", "#4c1d95"]

export default function PartnershipEarningsPage() {
  const t = useTranslations("PartnershipEarnings")
  const locale = useLocale()
  const months = getLast12Months()
  const [selectedMonth, setSelectedMonth] = useState("")
  const [data, setData] = useState<ProductRow[]>([])
  const [affiliate, setAffiliate] = useState<{ committed: number; paid: number; total: number }>({ committed: 0, paid: 0, total: 0 })
  const [stripeFees, setStripeFees] = useState<{
    gross: number; fee: number; net: number; orders: number; unknownCountry: number
    byMethod: { method: string; orders: number; gross: number; fee: number; net: number; unknownCountry: number }[]
  }>({ gross: 0, fee: 0, net: 0, orders: 0, unknownCountry: 0, byMethod: [] })
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    const url = selectedMonth
      ? `/api/admin/partnership-earnings?month=${selectedMonth}`
      : `/api/admin/partnership-earnings`
    fetch(url)
      .then(r => r.json())
      .then(d => {
        setData(d.products ?? [])
        setAffiliate(d.affiliate ?? { committed: 0, paid: 0, total: 0 })
        setStripeFees(d.stripeFees ?? { gross: 0, fee: 0, net: 0, orders: 0, unknownCountry: 0, byMethod: [] })
        setLoading(false)
      })
  }, [selectedMonth])

  const totalGross = data.reduce((acc, r) => acc + r.gross_revenue, 0)
  const totalPayout = data.reduce((acc, r) =>
    acc + r.partners.reduce((s, p) => s + p.payout, 0), 0)
  // Same shares applied to PayPal-net revenue — what the payout would be if
  // computed on money that actually lands in the account.
  const totalPayoutNet = data.reduce((acc, r) =>
    acc + r.partners.reduce((s, p) => s + (p.payout_net ?? p.payout), 0), 0)
  const totalManualRevenue = data.reduce((acc, r) => acc + (r.manual_revenue ?? 0), 0)
  const totalManualOrders = data.reduce((acc, r) => acc + (r.manual_orders ?? 0), 0)
  const totalPaypalRevenue = data.reduce((acc, r) => acc + (r.paypal_revenue ?? 0), 0)
  const totalPaypalOrders = data.reduce((acc, r) => acc + (r.paypal_orders ?? 0), 0)
  const totalPaypalAmountUsd = data.reduce((acc, r) => acc + (r.paypal_amount_usd ?? 0), 0)
  const totalPaypalNetUsd = data.reduce((acc, r) => acc + (r.paypal_net_usd ?? 0), 0)
  const totalPaypalNetThb = data.reduce((acc, r) => acc + (r.paypal_net_thb ?? 0), 0)
  const paypalFeeThb = totalPaypalRevenue - totalPaypalNetThb

  // รวม payout ต่อพาร์ทเนอร์ข้ามทุกสินค้า
  const partnerMap: Record<string, number> = {}
  data.forEach(r => {
    r.partners.forEach(p => {
      partnerMap[p.name] = (partnerMap[p.name] || 0) + p.payout
    })
  })
  const chartData = Object.entries(partnerMap)
    .map(([name, payout]) => ({ name, payout }))
    .sort((a, b) => b.payout - a.payout)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[24px] font-bold">{t("title")}</h1>
          <p className="text-text-muted text-[13px] mt-0.5">{t("subtitle")}</p>
        </div>
        <select
          value={selectedMonth}
          onChange={e => setSelectedMonth(e.target.value)}
          className="bg-bg-card border border-accent/10 rounded-xl px-4 py-2 text-[13px] text-text-base"
        >
          <option value="">{t("filter_all")}</option>
          {months.map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-bg-card border border-accent/10 rounded-2xl p-5">
          <p className="text-[11px] tracking-widest text-text-muted uppercase mb-2">{t("total_gross")}</p>
          <p className="text-[24px] font-bold text-text-base">
            ฿{totalGross.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-bg-card border border-accent/10 rounded-2xl p-5">
          <p className="text-[11px] tracking-widest text-text-muted uppercase mb-2">{t("total_payout")}</p>
          <p className="text-[24px] font-bold text-red-400">
            ฿{totalPayout.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
          {totalPayoutNet < totalPayout - 0.005 && (
            <p className="text-[11px] text-blue-300/90 mt-1 font-mono">
              {t("total_payout_net_hint")} ฿{totalPayoutNet.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          )}
        </div>
        <div className="bg-bg-card border border-accent/10 rounded-2xl p-5">
          <p className="text-[11px] tracking-widest text-text-muted uppercase mb-2">{t("active_products")}</p>
          <p className="text-[24px] font-bold text-accent-light">{data.length} {t("active_products_unit")}</p>
        </div>
      </div>

      {/* Stripe processing fee — store-wide cost for the same period, broken
          down per method so the number is auditable. */}
      {stripeFees.fee > 0 && (
        <div className="bg-bg-card border border-orange-400/20 rounded-2xl px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div>
              <p className="text-[11px] tracking-widest text-text-muted uppercase mb-1">{t("stripe_fee_storewide")}</p>
              <p className="text-[11px] text-text-muted">{t("stripe_fee_rates")}</p>
            </div>
            <p className="text-[22px] font-bold text-orange-400">
              −฿{stripeFees.fee.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="space-y-1 border-t border-white/5 pt-2.5">
            {stripeFees.byMethod.map(m => (
              <div key={m.method} className="flex justify-between text-[12px]">
                <span className="text-text-muted capitalize">
                  {m.method} · {m.orders} {t("orders_unit")}
                  {m.unknownCountry > 0 && (
                    <span className="text-amber-500/80 ml-1.5">{t("unknown_country_note", { n: m.unknownCountry })}</span>
                  )}
                </span>
                <span className="font-mono">
                  <span className="text-text-muted">฿{m.gross.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  <span className="text-orange-400 ml-2">−฿{m.fee.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Affiliate commission — store-wide expense for the same period. Partner
          shares above stay on gross; this is a separate store cost. */}
      {affiliate.total > 0 && (
        <div className="bg-bg-card border border-red-400/20 rounded-2xl px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] tracking-widest text-text-muted uppercase mb-1">{t("affiliate_commission_storewide")}</p>
              <p className="text-[11px] text-text-muted">
                {t("committed")} ฿{affiliate.committed.toLocaleString(undefined, { minimumFractionDigits: 2 })} · {t("paid_out")} ฿{affiliate.paid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>
            <p className="text-[22px] font-bold text-red-400">
              −฿{affiliate.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      )}

      {totalManualRevenue > 0 && (
        <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-2xl px-5 py-3">
          <p className="text-[12px] text-yellow-500/90 font-medium">{t("manual_included_label")}</p>
          <p className="text-[11px] text-text-muted mt-0.5">
            {t("manual_included_sub", {
              amount: totalManualRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 }),
              count: totalManualOrders,
            })}
          </p>
        </div>
      )}

      {/* PayPal Settlement card — surfaces only when there's PayPal revenue.
          Shows gross THB → fee (% of USD + $0.39/order) → net actually landing.
          Net is computed per-order in the API so the $0.39 fixed fee is
          applied N times, not once at the aggregate level. */}
      {totalPaypalRevenue > 0 && (
        <div className="bg-bg-card border border-blue-500/20 rounded-2xl p-5">
          <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
            <div>
              <p className="text-[11px] tracking-widest text-blue-400/90 uppercase font-medium">
                {t("paypal_settlement_title")}
              </p>
              <p className="text-[11px] text-text-muted mt-0.5">
                {t("paypal_settlement_sub", { count: totalPaypalOrders })}
              </p>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20">
              {t("paypal_fee_badge", { pct: PAYPAL_FEE_PCT, fixed: PAYPAL_FIXED_FEE_USD.toFixed(2) })}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">
                {t("paypal_gross")}
              </p>
              <p className="text-[16px] font-bold text-text-base font-mono">
                ฿{totalPaypalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[10px] text-text-muted font-mono mt-0.5">
                ≈ ${totalPaypalAmountUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })} USD
              </p>
            </div>
            <div>
              <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">
                {t("paypal_fee")}
              </p>
              <p className="text-[16px] font-bold text-red-400 font-mono">
                −฿{paypalFeeThb.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[10px] text-text-muted font-mono mt-0.5">
                {totalPaypalOrders} × ${PAYPAL_FIXED_FEE_USD.toFixed(2)} + {PAYPAL_FEE_PCT}%
              </p>
            </div>
            <div>
              <p className="text-[10px] text-blue-400/80 uppercase tracking-wider mb-1 font-medium">
                {t("paypal_net")}
              </p>
              <p className="text-[18px] font-bold text-blue-300 font-mono">
                ฿{totalPaypalNetThb.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[10px] text-blue-400/60 font-mono mt-0.5">
                ≈ ${totalPaypalNetUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })} USD
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Bar Chart */}
      {!loading && chartData.length > 0 && (
        <div className="bg-bg-card border border-accent/10 rounded-2xl p-5">
          <p className="text-[11px] tracking-widest text-text-muted uppercase mb-4">{t("chart_title")}</p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={chartData}
              margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
            >
              <defs>
                <linearGradient id="payoutGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#5b91cb" />
                  <stop offset="100%" stopColor="#427ab5" />
                </linearGradient>
              </defs>

              <XAxis
                dataKey="name"
                tick={{ fill: "#94a3b8", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />

              <YAxis
                tickFormatter={(v) => `฿${(Number(v) / 1000).toFixed(0)}k`}
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />

              <Tooltip
                cursor={{ fill: "rgba(66,122,181,0.12)" }}
                contentStyle={{
                  background: "#161622",
                  border: "1px solid rgba(66,122,181,0.35)",
                  borderRadius: "12px",
                  fontSize: "13px",
                  color: "#e2e8f0",
                  boxShadow: "0 8px 24px rgba(66,122,181,0.15)",
                }}
                formatter={(value) => [
                  `฿${Number(value ?? 0).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`,
                  t("col_payout"),
                ]}
                labelStyle={{
                  color: "#cbd5e1",
                  fontWeight: 600,
                }}
              />

              <Bar
                dataKey="payout"
                fill="url(#payoutGradient)"
                radius={[8, 8, 0, 0]}
                maxBarSize={64}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Table */}
      <div className="bg-bg-card border border-accent/10 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] text-text-muted border-b border-white/5 bg-white/[0.02]">
                <th className="px-5 py-3.5 font-medium">{t("col_product")}</th>
                <th className="px-4 py-3.5 font-medium text-right">{t("col_orders")}</th>
                <th className="px-4 py-3.5 font-medium text-right">{t("col_revenue")}</th>
                <th className="px-4 py-3.5 font-medium text-right">{t("col_payout")}</th>
                <th className="px-4 py-3.5 font-medium text-right">{t("col_detail")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr><td colSpan={5} className="text-center py-12 text-text-muted">{t("loading")}</td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 text-text-muted">{t("no_data")}</td></tr>
              ) : data.map((r) => (
                // Fragment needs the key (not the inner <tr>) — it's the
                // direct child of the map.
                <Fragment key={r.id}>
                  <tr
                    className="hover:bg-white/[0.02] transition cursor-pointer"
                    onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                  >
                    <td className="px-5 py-4 font-medium">
                      <div className="flex flex-col gap-0.5">
                        <span>{locale === "th" ? r.name_th : r.name_en}</span>
                        <span className="text-[10px] text-text-muted font-mono">{r.id}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right font-mono text-text-muted">{r.total_orders}</td>
                    <td className="px-4 py-4 text-right font-mono font-bold">
                      ฿{r.gross_revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      {r.manual_revenue && r.manual_revenue > 0 ? (
                        <p className="text-[10px] text-yellow-500/80 mt-0.5 font-normal">
                          {t("manual_short")} ฿{r.manual_revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-4 text-right font-mono font-bold text-red-400">
                      ฿{r.partners.reduce((s, p) => s + p.payout, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      {(() => {
                        const rowNet = r.partners.reduce((s, p) => s + (p.payout_net ?? p.payout), 0)
                        const rowGross = r.partners.reduce((s, p) => s + p.payout, 0)
                        return rowNet < rowGross - 0.005 ? (
                          <p className="text-[10px] text-blue-300/80 mt-0.5 font-normal">
                            {t("total_payout_net_hint")} ฿{rowNet.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </p>
                        ) : null
                      })()}
                    </td>
                    <td className="px-4 py-4 text-right text-text-muted text-[11px]">
                      {expandedId === r.id ? t("hide") : t("show")}
                    </td>
                  </tr>
                  {expandedId === r.id && (() => {
                    // Split a partner's payout into the two settlement channels:
                    //   - Normal: Stripe + manual orders (lands as THB directly)
                    //   - PayPal Net: pre-computed by the API per-order so the
                    //     $0.39 fixed fee is applied per transaction, not once.
                    // Total = Normal + PayPal Net — equals p.payout MINUS the
                    // partner's share of PayPal fees.
                    const paypalRev = r.paypal_revenue ?? 0
                    const normalRev = r.gross_revenue - paypalRev
                    const paypalNetRev = r.paypal_net_thb ?? 0
                    return (
                      <tr key={`${r.id}-detail`} className="bg-white/[0.01]">
                        <td colSpan={5} className="px-5 py-4">
                          <div className="space-y-2">
                            {r.partners.map((p, i) => {
                              const shareFrac = p.share / 100
                              const payoutNormal = normalRev * shareFrac
                              const payoutPaypal = paypalNetRev * shareFrac
                              const hasPaypal = paypalRev > 0
                              return (
                                <div key={i} className="bg-white/[0.03] border border-white/5 rounded-xl p-3 flex justify-between items-center gap-4">
                                  <div className="min-w-0">
                                    <p className="font-bold text-text-base truncate">{p.name}</p>
                                    <p className="text-[11px] text-text-muted truncate">{p.contact}</p>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <p className="text-[10px] bg-accent/10 text-accent-light px-1.5 py-0.5 rounded inline-block mb-1.5">{p.share}%</p>
                                    {hasPaypal ? (
                                      <div className="space-y-1">
                                        <div className="flex items-baseline justify-end gap-2">
                                          <span className="text-[10px] text-text-muted uppercase tracking-wider">{t("payout_normal")}</span>
                                          <span className="font-mono font-bold text-green-400 text-[13px]">
                                            ฿{payoutNormal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                          </span>
                                        </div>
                                        <div className="flex items-baseline justify-end gap-2">
                                          <span className="text-[10px] text-blue-400/80 uppercase tracking-wider">{t("payout_paypal_net")}</span>
                                          <span className="font-mono font-bold text-blue-300 text-[13px]">
                                            ฿{payoutPaypal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                          </span>
                                        </div>
                                      </div>
                                    ) : (
                                      <p className="font-mono font-bold text-green-400 text-[14px]">
                                        ฿{p.payout.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </td>
                      </tr>
                    )
                  })()}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}