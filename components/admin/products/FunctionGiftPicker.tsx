"use client"

import { useMemo } from "react"
import Image from "next/image"
import Select, { type StylesConfig } from "react-select"
import { Coins, Gift as GiftIcon } from "lucide-react"
import type { gifts as Gift } from "@prisma/client"
import { getImageUrl } from "@/lib/getImageUrl"

type Option = { value: number | null; label: string; gift: Gift | null }
const styles: StylesConfig<Option, false> = {
  control: (base, state) => ({ ...base, minHeight: 40, background: "var(--color-bg-base)", borderColor: state.isFocused ? "var(--color-accent)" : "var(--color-border-soft)", borderRadius: 8, boxShadow: "none", ":hover": { borderColor: "var(--color-accent)" } }),
  input: base => ({ ...base, color: "var(--color-text-base)", fontSize: 12 }),
  singleValue: base => ({ ...base, color: "var(--color-text-base)", maxWidth: "100%" }),
  placeholder: base => ({ ...base, fontSize: 12, color: "var(--color-text-muted)" }),
  menuPortal: base => ({ ...base, zIndex: 9999 }),
  menu: base => ({ ...base, background: "var(--color-bg-card)", border: "1px solid var(--color-border-soft)", borderRadius: 8 }),
  option: (base, state) => ({ ...base, fontSize: 12, color: "var(--color-text-base)", background: state.isSelected ? "var(--color-accent-glow)" : state.isFocused ? "var(--color-surface-tint)" : "transparent", cursor: "pointer" }),
}
export function GiftDetails({ gift, unavailable }: { gift: Gift | null; unavailable?: string }) {
  return <span className="flex min-w-0 items-center gap-2 text-[12px]">
    {gift?.image_url ? <Image src={getImageUrl(gift.image_url)} alt="" width={24} height={24} className="h-6 w-6 shrink-0 object-contain" unoptimized /> : <GiftIcon className="h-5 w-5 shrink-0 text-text-muted" aria-hidden="true" />}
    <span className="min-w-0 truncate">{gift?.name || unavailable}</span>
    {gift && <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-text-muted"><Coins size={12} aria-hidden="true" />{gift.diamonds} · #{gift.id}</span>}
  </span>
}
export default function FunctionGiftPicker({ gifts, value, onChange, id, label, placeholder, noOptions, unavailable, disabled, inDialog = false }: {
  gifts: Gift[]; value: number | null; onChange: (value: number | null) => void; id: string; label: string; placeholder: string; noOptions: string; unavailable: string; disabled?: boolean; inDialog?: boolean
}) {
  const options = useMemo<Option[]>(() => [{ value: null, label: placeholder, gift: null }, ...gifts.map(gift => ({ value: gift.id, label: `${gift.name} ${gift.diamonds} #${gift.id}`, gift }))], [gifts, placeholder])
  const selected = options.find(option => option.value === value) || { value, label: unavailable, gift: null }
  return <Select<Option, false> instanceId={id} inputId={id} aria-label={label} options={options} value={selected} onChange={option => onChange(option?.value ?? null)} styles={styles}
    isDisabled={disabled} isSearchable menuPortalTarget={inDialog ? undefined : typeof document !== "undefined" ? document.body : null} menuPosition={inDialog ? "absolute" : "fixed"} menuPlacement="auto" maxMenuHeight={240} noOptionsMessage={() => noOptions}
    formatOptionLabel={option => option.gift ? <GiftDetails gift={option.gift} /> : <span className="text-[12px] text-text-muted">{option.label}</span>} />
}
