"use client"

import { useState, useEffect } from "react"
import { useTranslations } from "next-intl"

type Consignment = {
  id?: string
  owner_name: string
  owner_contact: string
  payout_share: number
}

type Props = {
  productId: string
  isConsignment: boolean
  onToggle: (val: boolean) => void
  initialConsignments: Consignment[]
  onUpdate: (consignments: Consignment[]) => void
  productPrice: number        // เพิ่มบรรทัดนี้
  platformCommission: number
  onCommissionChange: (val: number) => void
}

export default function ConsignmentManager({
  productId,
  isConsignment,
  onToggle,
  initialConsignments,
  onUpdate,
  productPrice,
  platformCommission,
  onCommissionChange
}: Props) {
  const t = useTranslations("AdminProductForm")
  const [list, setList] = useState<Consignment[]>(
    initialConsignments.length > 0
      ? initialConsignments.map(c => ({ ...c, payout_share: Number(c.payout_share) }))
      : [{ owner_name: "", owner_contact: "", payout_share: 100 }]
  )

  useEffect(() => {
    onUpdate(list)
  }, [list])

  const addOwner = () => {
    setList([...list, { owner_name: "", owner_contact: "", payout_share: 0 }])
  }

  const removeOwner = (idx: number) => {
    setList(list.filter((_, i) => i !== idx))
  }

  const updateOwner = (idx: number, k: keyof Consignment, v: any) => {
    const newList = [...list]
    newList[idx] = { ...newList[idx], [k]: v }
    setList(newList)
  }

  const totalShare = list.reduce((sum, c) => sum + Number(c.payout_share), 0)
  const isValid = totalShare === 100

  const poolPercentage = 100 - platformCommission

  return (
    <div className="space-y-6">
      {/* Toggle */}
      <div className="flex items-center justify-between p-4 bg-bg-card border border-accent/10 rounded-2xl">
        <div>
          <p className="text-[14px] font-semibold">{t("consignment_title")}</p>
          <p className="text-[12px] text-text-muted mt-0.5">
            {t("consignment_desc")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onToggle(!isConsignment)}
          className={`
    relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full
    transition-all duration-200 border-2
    ${isConsignment
              ? "bg-accent border-accent"
              : "bg-slate-300 border-slate-400 dark:bg-zinc-700 dark:border-zinc-600"} 
    focus:outline-none focus:ring-2 focus:ring-accent/20
  `}
        >
          <span
            className={`
      inline-block h-4 w-4 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.3)]
      transform transition-transform duration-200 ease-in-out
      ${isConsignment ? "translate-x-5" : "translate-x-1"}
    `}
          />
        </button>
      </div>

      {isConsignment && (
        <div className="space-y-6">
          {/* Section 1: Platform Share */}
          <div className="bg-bg-card border border-accent/20 rounded-2xl p-5 shadow-lg shadow-accent/5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent-light">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
              </div>
              <h3 className="text-[15px] font-bold text-text-base">Platform & System Share</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <div>
                <label className="block text-[11px] text-text-muted uppercase tracking-wider mb-2">Our Commission (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={platformCommission}
                    onChange={(e) => onCommissionChange(Number(e.target.value))}
                    className="w-full bg-bg-base border border-accent/30 rounded-xl px-4 py-3 text-[16px] font-bold text-accent-light outline-none focus:border-accent transition"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-accent-light/60 font-bold">%</span>
                </div>
                <p className="text-[11px] text-text-muted mt-2">
                  This percentage will be deducted from every sale automatically.
                </p>
              </div>

              <div className="bg-bg-base/50 rounded-xl p-4 border border-white/5">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[12px] text-text-muted">Available for Partners:</span>
                  <span className="text-[15px] font-bold text-green-400">{poolPercentage}%</span>
                </div>
                <div className="w-full h-1.5 bg-white/5 rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-accent rounded-full" style={{ width: `${platformCommission}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Partner Shares */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <h3 className="text-[15px] font-bold text-text-base">Partners Revenue Split</h3>
                <span className="px-2 py-0.5 rounded-md bg-white/5 text-text-muted text-[10px] font-mono uppercase tracking-wider">
                  Remaining Pool: {poolPercentage}%
                </span>
              </div>
              <button
                onClick={addOwner}
                className="text-[12px] px-3 py-1.5 rounded-xl bg-white/5 text-text-base border border-white/10 hover:bg-white/10 transition flex items-center gap-2"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                Add Partner
              </button>
            </div>

            <div className="space-y-3">
              {list.map((item, idx) => {
                const grossPercentage = (item.payout_share * poolPercentage) / 100;
                return (
                  <div key={idx} className="bg-bg-card border border-white/5 rounded-2xl p-5 relative group hover:border-accent/30 transition shadow-sm">
                    {list.length > 1 && (
                      <button
                        onClick={() => removeOwner(idx)}
                        className="absolute top-4 right-4 w-8 h-8 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition hover:bg-red-500 hover:text-white"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                      </button>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                      <div className="md:col-span-4">
                        <label className="block text-[11px] text-text-muted uppercase tracking-wider mb-2">Partner Name</label>
                        <input
                          value={item.owner_name}
                          onChange={(e) => updateOwner(idx, "owner_name", e.target.value)}
                          placeholder="e.g. John Doe"
                          className={input}
                        />
                      </div>
                      <div className="md:col-span-4">
                        <label className="block text-[11px] text-text-muted uppercase tracking-wider mb-2">Contact Info</label>
                        <input
                          value={item.owner_contact}
                          onChange={(e) => updateOwner(idx, "owner_contact", e.target.value)}
                          placeholder="Discord / Line ID"
                          className={input}
                        />
                      </div>
                      <div className="md:col-span-4">
                        <label className="block text-[11px] text-text-muted uppercase tracking-wider mb-2">Share of Pool (%)</label>
                        <div className="relative">
                          <input
                            type="number"
                            value={item.payout_share}
                            onChange={(e) => updateOwner(idx, "payout_share", Number(e.target.value))}
                            className={input}
                            placeholder="50"
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted text-[13px] font-bold">%</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 pt-4 border-t border-white/5 flex flex-wrap items-center justify-between gap-4">
                      <div className="flex gap-4">
                        <div className="space-y-0.5">
                          <p className="text-[10px] text-text-muted uppercase tracking-widest">Net Share from Gross Sale</p>
                          <p className="text-[14px] font-bold text-accent-light">{grossPercentage.toFixed(2)}%</p>
                        </div>
                      </div>

                      <div className="flex-1 max-w-[200px]">
                        <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-green-500/50 rounded-full" style={{ width: `${item.payout_share}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Validation Warning */}
            {!isValid && (
              <div className="p-4 rounded-2xl bg-orange-500/5 border border-orange-500/20 text-orange-400 text-[13px] flex items-center gap-3 animate-pulse">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                <p className="font-medium">The sum of partner shares must equal 100% of the pool. Currently: <span className="font-bold underline">{totalShare}%</span></p>
              </div>
            )}
          </div>

          {/* Master Percentage Summary */}
          <div className="bg-bg-card border border-white/10 rounded-3xl p-6 space-y-4 shadow-xl">
            <h3 className="text-[12px] tracking-[0.2em] text-text-muted uppercase font-black text-center border-b border-white/5 pb-4">Consignment Breakdown Summary</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <p className="text-[11px] text-text-muted uppercase">Platform Allocation</p>
                <p className="text-[22px] font-black text-accent-light">{platformCommission}%</p>
              </div>

              <div className="space-y-1">
                <p className="text-[11px] text-text-muted uppercase">Partners Total Allocation</p>
                <p className="text-[22px] font-black text-green-400">{poolPercentage}%</p>
              </div>
            </div>

            {/* Multi-color Progress Bar */}
            <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden flex mt-2">
              <div className="h-full bg-accent" style={{ width: `${platformCommission}%` }} title="Platform" />
              {isValid && list.map((item, i) => (
                <div
                  key={i}
                  className="h-full border-l border-black/20"
                  style={{
                    width: `${(item.payout_share * poolPercentage) / 100}%`,
                    backgroundColor: `hsl(${140 + (i * 40)}, 70%, 50%)`
                  }}
                  title={`${item.owner_name}: ${((item.payout_share * poolPercentage) / 100).toFixed(2)}%`}
                />
              ))}
            </div>
            <p className="text-[10px] text-center text-text-muted italic">
              Percentages are calculated based on the total transaction amount of each individual order.
            </p>
          </div>
        </div>
      )}

      {!isConsignment && (
        <div className="text-center py-16 text-text-muted text-[14px] bg-bg-card border border-accent/10 border-dashed rounded-3xl">
          <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4 opacity-50">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
          </div>
          {t("consignment_off_desc")}
        </div>
      )}
    </div>
  )
}

const input = "w-full bg-bg-base border border-white/10 rounded-xl px-4 py-3 text-[14px] outline-none focus:border-accent/60 transition shadow-inner"
