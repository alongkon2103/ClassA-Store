"use client"

// รายการออเดอร์เกม Maki ในหน้า "ออเดอร์ของฉัน" — แยกจากตารางออเดอร์หลักเพราะสินค้าเป็นของพาร์ทเนอร์ (ไม่มีคีย์/ตั้งค่า)
import { useLocale, useTranslations } from "next-intl"
import { Link } from "@/i18n/routing"
import { getImageUrl } from "@/lib/getImageUrl"
import { fmtDate, variantLabel } from "@/lib/i18n/locale"
import type { MakiOrderView } from "@/lib/makiOrders"

const TONE: Record<string, string> = { pending: "bg-gold/10 text-gold border-gold/25", paid: "bg-success/10 text-success border-success/25", expired: "bg-hot/10 text-hot border-hot/25", failed: "bg-hot/10 text-hot border-hot/25" }

export default function MakiOrdersSection({ orders }: { orders: MakiOrderView[] }) {
  const t = useTranslations("Orders")
  const locale = useLocale()
  return (
    <section className="bg-bg-card border border-border-soft rounded-[14px] overflow-hidden mb-6">
      <div className="px-5 py-4 border-b border-border-soft flex items-center gap-2">
        <span className="px-2 py-0.5 rounded-md bg-violet-500/15 text-violet-300 text-[0.65rem] font-bold uppercase tracking-[0.05em]">Partner</span>
        <h2 className="text-[0.95rem] font-bold">{t("maki_section_title")}</h2>
      </div>
      <ul className="divide-y divide-border-soft">
        {orders.map((o) => {
          const name = o.product ? (locale === "th" ? o.product.name_th : o.product.name_en) : o.plan_key
          const payable = o.status === "pending" && !!o.payment_url && (!o.expires_at || new Date(o.expires_at) > new Date())
          return (
            <li key={o.id} className="px-5 py-3.5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0" style={{ background: "var(--gradient-thumb)" }}>
                {o.product?.image && <img src={getImageUrl(o.product.image)} alt="" className="w-full h-full object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[0.88rem] font-bold truncate">{name}</p>
                <p className="text-[0.72rem] text-text-dim">{o.plan ? variantLabel(o.plan, locale) : o.plan_key} · ฿{o.price_thb.toLocaleString()} · {fmtDate(o.created_at, locale)}</p>
              </div>
              <span className={`hidden sm:inline-flex px-2.5 py-1 rounded-full text-[0.68rem] font-bold border ${TONE[o.status] ?? TONE.pending}`}>{t(`maki_status_${o.status}`)}</span>
              {payable && <a href={o.payment_url!} className="px-3.5 py-2 rounded-lg bg-accent hover:bg-accent-light text-white text-[0.75rem] font-bold transition-colors">{t("maki_pay_now")}</a>}
              <Link href={`/orders/maki/${o.id}`} className="px-3.5 py-2 rounded-lg border border-border-soft text-text-muted hover:text-text-base text-[0.75rem] font-semibold transition-colors">{t("maki_view")}</Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
