"use client"

import { useId } from 'react'

/** Task tabs use roving focus on desktop and a labelled select on narrow screens. */
export default function WorkspaceTabs({ label, tabs, value, onChange, panelId }: {
  label: string
  tabs: { key: string; label: string }[]
  value: string
  onChange: (key: string) => void
  panelId?: string
}) {
  const id = useId()
  return <div>
    <label htmlFor={id} className="mb-2 block text-xs text-text-muted md:hidden">{label}</label>
    <select id={id} value={value} onChange={e => onChange(e.target.value)} className="min-h-11 w-full rounded-lg border border-border-soft bg-bg-input px-3 text-sm text-text-base md:hidden">
      {tabs.map(tab => <option key={tab.key} value={tab.key}>{tab.label}</option>)}
    </select>
    <div role="tablist" aria-label={label} className="hidden flex-wrap gap-x-5 border-b border-border-soft md:flex">
      {tabs.map((tab, index) => <button key={tab.key} type="button" role="tab" aria-controls={panelId} aria-selected={value === tab.key} tabIndex={value === tab.key ? 0 : -1}
        onClick={() => onChange(tab.key)} onKeyDown={event => {
          let next = index
          if (event.key === 'ArrowRight') next = (index + 1) % tabs.length
          else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length
          else if (event.key === 'Home') next = 0
          else if (event.key === 'End') next = tabs.length - 1
          else return
          event.preventDefault()
          onChange(tabs[next].key)
          const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
          buttons?.[next]?.focus()
        }} className={`min-h-12 border-b-2 px-1 py-3 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent ${value === tab.key ? 'border-accent text-accent-light' : 'border-transparent text-text-muted hover:text-text-base'}`}>{tab.label}</button>)}
    </div>
  </div>
}
