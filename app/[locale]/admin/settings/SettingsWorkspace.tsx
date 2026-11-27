"use client"

import { useRef, useState, type KeyboardEvent } from "react"
import { useLocale } from "next-intl"
import GlobalSettingsClient from "./GlobalSettingsClient"
import PaymentSettingsClient from "./PaymentSettingsClient"
import FeaturesSettingsClient from "./FeaturesSettingsClient"
import RulesSettingsClient from "./RulesSettingsClient"
import MaintenanceSettingsClient from "./MaintenanceSettingsClient"

const sections = [
  { id: "general", th: "ทั่วไป", en: "General" },
  { id: "payments", th: "การชำระเงิน", en: "Payments" },
  { id: "features", th: "ฟีเจอร์", en: "Features" },
  { id: "rules", th: "กฎการใช้งาน", en: "Rules" },
  { id: "maintenance", th: "บำรุงรักษา", en: "Maintenance" },
] as const

type SectionId = (typeof sections)[number]["id"]

export default function SettingsWorkspace({ initialConfigs }: { initialConfigs: Record<string, string> }) {
  const th = useLocale() === "th"
  const [active, setActive] = useState<SectionId>("general")
  const [visited, setVisited] = useState<SectionId[]>(["general"])
  const tabRefs = useRef<Partial<Record<SectionId, HTMLButtonElement | null>>>({})

  const selectSection = (id: SectionId) => {
    setActive(id)
    setVisited(current => current.includes(id) ? current : [...current, id])
  }

  const handleTabKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number
    if (event.key === "ArrowRight") next = (index + 1) % sections.length
    else if (event.key === "ArrowLeft") next = (index - 1 + sections.length) % sections.length
    else if (event.key === "Home") next = 0
    else if (event.key === "End") next = sections.length - 1
    else return
    event.preventDefault()
    const id = sections[next].id
    selectSection(id)
    tabRefs.current[id]?.focus()
  }

  const saveHints: Record<Exclude<SectionId, "maintenance">, string> = th ? {
    general: "บันทึกหมวดนี้เพื่ออัปเดตการทดลองใช้ฟรีและข้อมูลดาวน์โหลดโปรแกรม",
    payments: "บันทึกหมวดนี้เพื่ออัปเดตช่องทางชำระเงิน ค่าธรรมเนียม และข้อมูล PayPal.me",
    features: "บันทึกหมวดนี้เพื่ออัปเดตการเปิดใช้งานฟีเจอร์ของร้าน",
    rules: "ปุ่มบันทึกในหมวดนี้จะบันทึกกฎการใช้งานทั้ง 6 ภาษาพร้อมกัน",
  } : {
    general: "Save this section to update the free trial and program download details.",
    payments: "Save this section to update payment methods, fees and PayPal.me details.",
    features: "Save this section to update which store features are available.",
    rules: "The save button in this section saves the rules in all six languages together.",
  }

  const panels = {
    general: <GlobalSettingsClient initialConfigs={initialConfigs} />,
    payments: <PaymentSettingsClient initialConfigs={initialConfigs} />,
    features: <FeaturesSettingsClient initialConfigs={initialConfigs} />,
    rules: <RulesSettingsClient
      initialRulesTh={initialConfigs.rules_th ?? ""}
      initialRulesEn={initialConfigs.rules_en ?? ""}
      initialRulesJa={initialConfigs.rules_ja ?? ""}
      initialRulesZh={initialConfigs.rules_zh ?? ""}
      initialRulesKo={initialConfigs.rules_ko ?? ""}
      initialRulesVi={initialConfigs.rules_vi ?? ""}
    />,
    maintenance: <MaintenanceSettingsClient />,
  }

  return (
    <div className="min-w-0 space-y-6 pb-12">
      <header>
        <h1 className="text-2xl font-bold text-text-base">{th ? "ตั้งค่าร้าน" : "Store settings"}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-text-muted">
          {th
            ? "แต่ละหมวดมีปุ่มบันทึกของตัวเอง การเปลี่ยนหมวดจะเก็บสิ่งที่แก้ไขไว้จนกว่าคุณจะออกจากหน้านี้"
            : "Each section has its own save button. Switching sections keeps your edits until you leave this page."}
        </p>
      </header>

      <div className="min-w-0 border-b border-border-soft pb-3">
        <div className="sm:hidden">
          <label htmlFor="settings-section" className="mb-2 block text-sm font-medium text-text-muted">
            {th ? "หมวดการตั้งค่า" : "Settings section"}
          </label>
          <select
            id="settings-section"
            value={active}
            onChange={event => selectSection(event.target.value as SectionId)}
            className="min-h-11 w-full rounded-xl border border-border-soft bg-bg-card px-3 py-2 text-sm text-text-base outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {sections.map(section => <option key={section.id} value={section.id}>{th ? section.th : section.en}</option>)}
          </select>
        </div>
        <div role="tablist" aria-label={th ? "หมวดการตั้งค่า" : "Settings sections"} className="hidden flex-wrap gap-1 sm:flex">
          {sections.map((section, index) => (
            <button
              key={section.id}
              ref={node => { tabRefs.current[section.id] = node }}
              id={`settings-tab-${section.id}`}
              type="button"
              role="tab"
              aria-selected={active === section.id}
              aria-controls={`settings-panel-${section.id}`}
              tabIndex={active === section.id ? 0 : -1}
              onClick={() => selectSection(section.id)}
              onKeyDown={event => handleTabKey(event, index)}
              className={`min-h-11 rounded-xl px-4 py-2.5 text-sm font-semibold transition outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base ${active === section.id ? "bg-accent/10 text-accent-light" : "text-text-muted hover:bg-[var(--color-surface-tint)] hover:text-text-base"}`}
            >
              {th ? section.th : section.en}
            </button>
          ))}
        </div>
      </div>

      {sections.map(section => (
        <div
          key={section.id}
          id={`settings-panel-${section.id}`}
          role="tabpanel"
          aria-labelledby={`settings-tab-${section.id}`}
          hidden={active !== section.id}
          tabIndex={0}
          className="min-w-0 space-y-5 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {visited.includes(section.id) && <>
            {section.id !== "maintenance" && <p className="text-sm leading-relaxed text-text-muted">{saveHints[section.id]}</p>}
            {panels[section.id]}
          </>}
        </div>
      ))}
    </div>
  )
}
