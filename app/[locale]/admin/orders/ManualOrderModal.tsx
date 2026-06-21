"use client"

import { useState, useEffect } from "react"
import { useTranslations, useLocale } from "next-intl"

type Variant = {
  id: string
  label_en: string | null
  label_th: string | null
  price: number
}
type Product = {
  id: string
  name_en: string | null
  name_th: string | null
  is_active: boolean
  product_variants: Variant[]
}

const CHANNELS = ["paypal", "promptpay", "transfer", "cash", "other"] as const

export default function ManualOrderModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: () => void
}) {
  const t = useTranslations("Admin")
  const locale = useLocale()
  const isTH = locale === "th"

  const [products, setProducts] = useState<Product[]>([])
  const [productsLoading, setProductsLoading] = useState(false)

  const [productId, setProductId] = useState("")
  const [variantId, setVariantId] = useState("")
  const [amount, setAmount] = useState("")
  const [channel, setChannel] = useState<typeof CHANNELS[number]>("paypal")
  const [buyerLabel, setBuyerLabel] = useState("")
  const [inGameName, setInGameName] = useState("")
  const [alreadyFulfilled, setAlreadyFulfilled] = useState(true)
  const [note, setNote] = useState("")
  const [paidAt, setPaidAt] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open || products.length > 0) return
    setProductsLoading(true)
    fetch("/api/admin/products")
      .then((r) => r.json())
      .then((data: Product[]) => setProducts(Array.isArray(data) ? data : []))
      .finally(() => setProductsLoading(false))
  }, [open, products.length])

  // Auto-fill amount from variant price when variant changes
  useEffect(() => {
    if (!variantId) return
    const product = products.find((p) => p.id === productId)
    const variant = product?.product_variants.find((v) => v.id === variantId)
    if (variant && !amount) setAmount(String(variant.price))
  }, [variantId, productId, products, amount])

  const reset = () => {
    setProductId("")
    setVariantId("")
    setAmount("")
    setChannel("paypal")
    setBuyerLabel("")
    setInGameName("")
    setAlreadyFulfilled(true)
    setNote("")
    setPaidAt("")
    setError("")
  }

  const handleClose = () => {
    if (saving) return
    reset()
    onClose()
  }

  const handleSave = async () => {
    setError("")
    if (!productId) return setError(t("manual_err_product"))
    const amt = parseFloat(amount)
    if (!Number.isFinite(amt) || amt <= 0) return setError(t("manual_err_amount"))
    if (!buyerLabel.trim()) return setError(t("manual_err_buyer"))

    setSaving(true)
    const res = await fetch("/api/admin/orders/manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product_id: productId,
        variant_id: variantId || null,
        amount: amt,
        payment_method: channel,
        buyer_label: buyerLabel.trim(),
        in_game_name: inGameName.trim() || null,
        already_fulfilled: alreadyFulfilled,
        manual_note: note.trim() || null,
        paid_at: paidAt ? new Date(paidAt).toISOString() : null,
      }),
    })
    setSaving(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      return setError(data.error || "Failed")
    }
    reset()
    onCreated()
    onClose()
  }

  if (!open) return null

  const selectedProduct = products.find((p) => p.id === productId)
  const variants = selectedProduct?.product_variants ?? []

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-lg bg-bg-card border border-accent/15 rounded-2xl p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-1">
          <h2 className="text-[18px] font-bold text-text-base">{t("manual_order_title")}</h2>
          <button
            onClick={handleClose}
            className="text-text-muted hover:text-text-base text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <p className="text-[12px] text-text-muted mb-5">{t("manual_order_subtitle")}</p>

        <div className="space-y-4">
          <Field label={t("field_product")}>
            <select
              value={productId}
              onChange={(e) => {
                setProductId(e.target.value)
                setVariantId("")
                setAmount("")
              }}
              className={inp}
              disabled={productsLoading}
            >
              <option value="">{productsLoading ? "..." : t("manual_pick_product")}</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {(isTH ? p.name_th : p.name_en) || p.name_en || p.name_th}
                </option>
              ))}
            </select>
          </Field>

          {variants.length > 0 && (
            <Field label={t("field_variant")}>
              <select value={variantId} onChange={(e) => setVariantId(e.target.value)} className={inp}>
                <option value="">{t("manual_pick_variant")}</option>
                {variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {(isTH ? v.label_th : v.label_en) || v.label_en || v.label_th} — ฿{v.price}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label={`${t("field_amount")} (฿)`}>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={inp}
                placeholder="0.00"
              />
            </Field>

            <Field label={t("field_payment_channel")}>
              <select value={channel} onChange={(e) => setChannel(e.target.value as typeof CHANNELS[number])} className={inp}>
                {CHANNELS.map((c) => (
                  <option key={c} value={c}>{t(`channel_${c}`)}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label={t("field_buyer_label")}>
            <input
              value={buyerLabel}
              onChange={(e) => setBuyerLabel(e.target.value)}
              className={inp}
              placeholder={t("field_buyer_placeholder")}
            />
          </Field>

          <Field label={t("field_in_game_name_optional")}>
            <input
              value={inGameName}
              onChange={(e) => setInGameName(e.target.value)}
              className={inp}
              placeholder={t("field_in_game_name_placeholder")}
            />
          </Field>

          <label className="flex items-start gap-3 p-3 bg-white/[0.03] border border-white/5 rounded-xl cursor-pointer">
            <input
              type="checkbox"
              checked={alreadyFulfilled}
              onChange={(e) => setAlreadyFulfilled(e.target.checked)}
              className="mt-0.5 accent-accent-light"
            />
            <span className="flex-1">
              <span className="text-[13px] font-medium text-text-base block">
                {t("field_already_fulfilled")}
              </span>
              <span className="text-[11px] text-text-muted">
                {t("field_already_fulfilled_hint")}
              </span>
            </span>
          </label>

          <Field label={t("field_paid_at_optional")}>
            <input
              type="datetime-local"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              className={inp}
            />
          </Field>

          <Field label={t("field_note_optional")}>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className={`${inp} resize-y`}
              placeholder={t("field_note_placeholder")}
            />
          </Field>

          {error && (
            <p className="text-[12px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={handleClose}
              disabled={saving}
              className="px-5 py-2.5 rounded-xl text-[13px] text-text-muted hover:bg-white/[0.04] transition disabled:opacity-40"
            >
              {t("cancel")}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-accent text-white text-[13px] font-medium hover:opacity-90 active:scale-95 transition disabled:opacity-40 flex items-center gap-2"
            >
              {saving && <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              {t("manual_save")}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] text-text-muted font-medium uppercase tracking-wider">{label}</label>
      {children}
    </div>
  )
}

const inp =
  "w-full bg-bg-base border border-accent/15 rounded-xl px-3 py-2.5 text-[13px] placeholder:text-text-muted outline-none focus:border-accent/40 transition"
