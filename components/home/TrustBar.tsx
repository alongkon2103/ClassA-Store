"use client"

// แถบความน่าเชื่อถือ 4 ช่อง ใต้ hero — เส้นคั่นระหว่างช่องทำด้วย gap 1px
// บนพื้นสี border แล้วให้แต่ละช่องทับด้วยสีพื้น (เทคนิคเดียวกับต้นแบบ)
import { useTranslations } from "next-intl"

const ICONS = {
  shield: (
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </>
  ),
  bolt: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
  refresh: (
    <>
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </>
  ),
  chat: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
} as const

export default function TrustBar() {
  const t = useTranslations("Home")
  const items = [
    { icon: "shield", title: t("trust_secure_t"), desc: t("trust_secure_d") },
    { icon: "bolt", title: t("trust_instant_t"), desc: t("trust_instant_d") },
    { icon: "refresh", title: t("trust_update_t"), desc: t("trust_update_d") },
    { icon: "chat", title: t("trust_support_t"), desc: t("trust_support_d") },
  ] as const

  return (
    <div className="max-w-[1248px] mx-auto px-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-border-soft rounded-[14px] overflow-hidden my-6">
        {items.map((it) => (
          <div key={it.title} className="bg-bg-surface hover:bg-bg-card transition-colors px-6 py-[22px] flex items-center gap-3.5">
            <div className="w-[46px] h-[46px] rounded-xl flex items-center justify-center flex-shrink-0 text-accent-light border border-accent/15"
                 style={{ background: "linear-gradient(135deg,rgba(37,99,235,0.12),rgba(37,99,235,0.04))" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {ICONS[it.icon]}
              </svg>
            </div>
            <div>
              <h4 className="text-[0.85rem] font-bold mb-0.5">{it.title}</h4>
              <p className="text-[0.72rem] text-text-dim">{it.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
