"use client"

// หน้า FAQ ตามดีไซน์ใหม่: ค้นหา + แท็บหมวด + accordion + sidebar ช่วยเหลือ
// เนื้อหาอยู่ใน messages/*.json (namespace "Faq") แก้คำได้โดยไม่ต้องแตะโค้ด
import { useMemo, useState } from "react"
import { useTranslations } from "next-intl"

type Item = { q: string; a: string }
type Section = { icon: string; title: string; items: Item[] }

const DISCORD_URL = "https://discord.gg/vCuPy8H9ub"
const MAIL = "storeaclass@gmail.com"

const SECTION_ICON: Record<string, React.ReactNode> = {
  cart: (<><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /></>),
  card: (<><rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" /></>),
  game: (<><line x1="6" y1="11" x2="10" y2="11" /><line x1="8" y1="9" x2="8" y2="13" /><line x1="15" y1="12" x2="15.01" y2="12" /><line x1="18" y1="10" x2="18.01" y2="10" /><rect x="2" y="6" width="20" height="12" rx="2" /></>),
  user: (<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>),
}

export default function FaqClient() {
  const t = useTranslations("Faq")
  const sections = t.raw("sections") as Section[]
  const [query, setQuery] = useState("")
  const [tab, setTab] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(`0-0`)

  // กรองตามแท็บก่อน แล้วค่อยกรองด้วยคำค้น (ดูทั้งคำถามและคำตอบ)
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return sections
      .filter((s) => !tab || s.title === tab)
      .map((s) => ({
        ...s,
        items: q ? s.items.filter((i) => (i.q + " " + i.a).toLowerCase().includes(q)) : s.items,
      }))
      .filter((s) => s.items.length > 0)
  }, [sections, tab, query])

  return (
    <>
      <div className="page-container">
        {/* HERO */}
        <div className="text-center pt-14 pb-10">
          <h1 className="text-[1.6rem] sm:text-[2.2rem] font-black tracking-[-0.02em] mb-2.5">{t("title")}</h1>
          <p className="text-[0.95rem] text-text-muted max-w-[500px] mx-auto mb-7">{t("subtitle")}</p>

          <div className="flex max-w-[520px] mx-auto bg-bg-card border border-border-soft rounded-xl overflow-hidden focus-within:border-accent transition-colors">
            <div className="px-3.5 flex items-center text-text-dim">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("search_placeholder")}
              className="flex-1 py-3.5 pr-3.5 bg-transparent border-none text-text-base text-[0.88rem] outline-none placeholder:text-text-dim"
            />
          </div>
        </div>

        {/* TABS */}
        <div className="flex justify-center gap-2 flex-wrap mb-10">
          {[{ title: t("tab_all"), value: null as string | null }, ...sections.map((s) => ({ title: s.title, value: s.title }))].map((x) => {
            const active = tab === x.value
            return (
              <button
                key={x.title}
                onClick={() => setTab(x.value)}
                className={`px-3.5 sm:px-5 py-[7px] sm:py-[9px] rounded-[20px] border text-[0.75rem] sm:text-[0.82rem] font-semibold transition-colors ${
                  active ? "bg-accent border-accent text-white" : "border-border-soft text-text-muted hover:border-border-light hover:text-text-base"
                }`}
              >
                {x.title}
              </button>
            )
          })}
        </div>

        {/* CONTENT + SIDEBAR */}
        <div className="grid gap-10 grid-cols-1 lg:grid-cols-[1fr_340px] mb-14">
          <div>
            {shown.length === 0 && <p className="text-text-muted text-sm py-10 text-center">{t("no_result")}</p>}

            {shown.map((s, si) => (
              <div key={s.title} className="mb-8">
                <div className="text-[1.05rem] font-extrabold mb-3.5 flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-lg flex items-center justify-center text-accent-light border border-accent/15"
                        style={{ background: "linear-gradient(135deg,rgba(37,99,235,0.12),rgba(37,99,235,0.04))" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      {SECTION_ICON[s.icon]}
                    </svg>
                  </span>
                  {s.title}
                </div>

                <div className="flex flex-col">
                  {s.items.map((it, ii) => {
                    const key = `${si}-${ii}`
                    const isOpen = open === key
                    return (
                      <div key={key} className="border-b border-border-soft">
                        <button
                          onClick={() => setOpen(isOpen ? null : key)}
                          className="w-full flex items-center justify-between gap-4 py-5 text-left"
                        >
                          <h3 className="text-[0.82rem] sm:text-[0.92rem] font-medium text-text-base flex-1">{it.q}</h3>
                          <span className={`flex-shrink-0 ${isOpen ? "text-accent-light" : "text-text-muted"}`}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              {!isOpen && <line x1="12" y1="5" x2="12" y2="19" />}
                              <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                          </span>
                        </button>
                        <div className={`overflow-hidden transition-[max-height] duration-300 ${isOpen ? "max-h-[500px]" : "max-h-0"}`}>
                          <p className="pb-5 text-[0.86rem] text-text-muted leading-[1.85]">{it.a}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* SIDEBAR */}
          <aside className="flex flex-col gap-5">
            <HelpCard
              title={t("help_discord_title")} desc={t("help_discord_desc")} btn={t("help_discord_btn")}
              href={DISCORD_URL}
              icon={<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />}
            />
            <HelpCard
              title={t("help_mail_title")} desc={t("help_mail_desc")} btn={t("help_mail_btn")}
              href={`mailto:${MAIL}`}
              icon={<><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></>}
            />

            <div className="bg-bg-card border border-border-soft rounded-[14px] p-5">
              <h3 className="text-[0.92rem] font-bold mb-3.5">{t("popular")}</h3>
              <ul className="flex flex-col gap-1.5">
                {sections.flatMap((s, si) => s.items.slice(0, 1).map((it, ii) => ({ key: `${si}-${ii}`, q: it.q })))
                  .map((p) => (
                    <li key={p.key}>
                      <button
                        onClick={() => { setTab(null); setQuery(""); setOpen(p.key); }}
                        className="w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[0.8rem] text-text-muted hover:bg-white/[0.03] hover:text-text-base transition-colors"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent-light flex-shrink-0">
                          <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                        {p.q}
                      </button>
                    </li>
                  ))}
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </>
  )
}

function HelpCard({ title, desc, btn, href, icon }: { title: string; desc: string; btn: string; href: string; icon: React.ReactNode }) {
  return (
    <div className="bg-bg-card border border-border-soft rounded-[14px] p-6 text-center">
      <div className="w-[52px] h-[52px] rounded-[14px] mx-auto mb-3.5 flex items-center justify-center text-accent-light border border-accent/15"
           style={{ background: "linear-gradient(135deg,rgba(37,99,235,0.12),rgba(37,99,235,0.04))" }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{icon}</svg>
      </div>
      <h3 className="text-[0.95rem] font-bold mb-1.5">{title}</h3>
      <p className="text-[0.78rem] text-text-dim mb-4 leading-[1.6]">{desc}</p>
      <a href={href} target="_blank" rel="noopener noreferrer"
         className="inline-flex items-center gap-2 px-[22px] py-2.5 rounded-[10px] bg-accent hover:bg-accent-light text-white text-[0.82rem] font-semibold transition-all hover:-translate-y-px">
        {btn}
      </a>
    </div>
  )
}
