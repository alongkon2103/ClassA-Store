"use client"

import { useId } from "react"
import { useTranslations } from "next-intl"

// null = all products; [] = the user has not picked a game yet.
export default function ProductScopePicker({ products, value, onChange }: {
  products: { id: string; name: string }[]
  value: string[] | null
  onChange: (value: string[] | null) => void
}) {
  const t = useTranslations("AdminAffiliates")
  const id = useId()
  const options = [...products, ...(value ?? []).filter(id => !products.some(p => p.id === id)).map(id => ({ id, name: t("unavailable_product", { id }) }))]
  return <fieldset className="min-w-0">
    <legend className="text-[10px] text-text-muted mb-1 uppercase tracking-wider">{t("label_product")}</legend>
    <select aria-label={t("label_product")} value={value === null ? "all" : "selected"}
      onChange={e => onChange(e.target.value === "all" ? null : value ?? [])}
      className="w-full bg-bg-base border border-accent/15 rounded-lg px-3 py-2 text-[13px]">
      <option value="all">{t("all_products")}</option>
      <option value="selected">{t("selected_products")}</option>
    </select>
    {value !== null && <>
      <div className="mt-2 max-h-44 overflow-y-auto rounded-lg border border-accent/15 bg-bg-base p-2 space-y-1" role="group" aria-label={t("selected_products")}>
        {options.map(p => <label key={p.id} htmlFor={`${id}-${p.id}`} className="flex items-start gap-2 rounded-md px-2 py-1.5 text-[13px] cursor-pointer hover:bg-accent/10">
          <input id={`${id}-${p.id}`} type="checkbox" checked={value.includes(p.id)} className="mt-0.5 accent-[var(--color-accent)] shrink-0"
            onChange={e => onChange(e.target.checked ? [...value, p.id] : value.filter(v => v !== p.id))} />
          <span className="break-words min-w-0">{p.name}</span>
        </label>)}
      </div>
      <p className={`mt-1.5 text-[11px] ${value.length ? "text-text-muted" : "text-red-400"}`} role={value.length ? undefined : "status"}>
        {value.length ? t("selected_products_count", { count: value.length }) : t("select_products_required")}
      </p>
    </>}
  </fieldset>
}
