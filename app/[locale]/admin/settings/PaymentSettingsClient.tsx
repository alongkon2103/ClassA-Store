"use client"

import { useState } from "react"
import { useLocale, useTranslations } from "next-intl"

type Props = {
  initialConfigs?: Record<string, string>
}

type MethodState = {
  enabled: boolean
  fee_pct: string
}

const METHOD_KEYS = ["card", "promptpay", "paypal", "paypal_me"] as const
type MethodKey = (typeof METHOD_KEYS)[number]

function parseBool(v: string | undefined, fallback: boolean): boolean {
  if (v === undefined || v === null || v === "") return fallback
  return v === "true"
}

export default function PaymentSettingsClient({ initialConfigs = {} }: Props) {
  const t = useTranslations("Admin")
  const th = useLocale() === "th"

  const [methods, setMethods] = useState<Record<MethodKey, MethodState>>({
    card: {
      enabled: parseBool(initialConfigs.payment_card_enabled, true),
      fee_pct: initialConfigs.payment_card_fee_pct ?? "6",
    },
    promptpay: {
      enabled: parseBool(initialConfigs.payment_promptpay_enabled, true),
      fee_pct: initialConfigs.payment_promptpay_fee_pct ?? "0",
    },
    paypal: {
      enabled: parseBool(initialConfigs.payment_paypal_enabled, true),
      fee_pct: initialConfigs.payment_paypal_fee_pct ?? "0",
    },
    // PayPal.me (email-verified). Default OFF to match the backend default — the
    // worker must be running before customers see this method.
    paypal_me: {
      enabled: parseBool(initialConfigs.payment_paypal_me_enabled, false),
      fee_pct: initialConfigs.payment_paypal_me_fee_pct ?? "0",
    },
  })
  // PayPal.me link is a standalone config (not a per-method fee) shown on the pay page.
  const [paypalMeLink, setPaypalMeLink] = useState(initialConfigs.paypal_me_link ?? "")
  // Currency the customer sends via PayPal.me. THB lets the owner test with a Thai
  // account (which can't send USD); defaults to USD for real foreign customers.
  const [paypalMeCurrency, setPaypalMeCurrency] = useState<"USD" | "THB">(
    initialConfigs.paypal_me_currency === "THB" ? "THB" : "USD",
  )
  const [saving, setSaving] = useState(false)

  const update = (m: MethodKey, patch: Partial<MethodState>) => {
    setMethods((s) => ({ ...s, [m]: { ...s[m], ...patch } }))
  }

  const handleSave = async () => {
    setSaving(true)
    const configs: Record<string, string> = {}
    for (const m of METHOD_KEYS) {
      configs[`payment_${m}_enabled`] = String(methods[m].enabled)
      // Normalise the fee — coerce to a finite non-negative number; falls back to "0".
      const parsed = parseFloat(methods[m].fee_pct)
      configs[`payment_${m}_fee_pct`] = Number.isFinite(parsed) && parsed >= 0 ? String(parsed) : "0"
    }
    configs.paypal_me_link = paypalMeLink.trim()
    configs.paypal_me_currency = paypalMeCurrency
    try {
      const res = await fetch("/api/admin/settings/configs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ configs }),
      })
      if (res.ok) {
        alert(t("save_config_success") || "Saved")
      } else {
        const data = await res.json().catch(() => ({}))
        alert(data.error || "Failed to save")
      }
    } catch {
      alert("Failed to save")
    } finally {
      setSaving(false)
    }
  }

  const labels: Record<MethodKey, { title: string; hint: string }> = {
    card: { title: t("payment_method_card"), hint: t("payment_method_card_hint") },
    promptpay: { title: t("payment_method_promptpay"), hint: t("payment_method_promptpay_hint") },
    paypal: { title: t("payment_method_paypal"), hint: t("payment_method_paypal_hint") },
    paypal_me: { title: t("payment_method_paypal_me"), hint: t("payment_method_paypal_me_hint") },
  }

  return (
    <section>
      <h2 className="text-[20px] font-bold text-text-base mb-4 flex items-center gap-2">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-light">
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
        </svg>
        {t("payment_settings_title")}
      </h2>

      <div className="bg-bg-card border border-border-soft rounded-2xl p-4 sm:p-6 space-y-4">
        {METHOD_KEYS.map((m) => {
          const s = methods[m]
          return (
            <div
              key={m}
              className={`p-4 rounded-xl border transition ${
                s.enabled ? "bg-accent/5 border-accent/20" : "bg-bg-base border-border-soft"
              }`}
            >
              <div className="flex items-center justify-between gap-4 mb-3">
                <div>
                  <p id={`payment-${m}-label`} className="text-[14px] font-bold text-text-base">{labels[m].title}</p>
                  <p className="text-[12px] text-text-muted mt-0.5">{labels[m].hint}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={s.enabled}
                  aria-labelledby={`payment-${m}-label`}
                  onClick={() => update(m, { enabled: !s.enabled })}
                  className={`relative w-12 h-6 rounded-full transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-card shrink-0 ${
                    s.enabled ? "bg-accent" : "bg-white/10"
                  }`}
                >
                  <div
                    className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
                      s.enabled ? "translate-x-6" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <fieldset disabled={!s.enabled} className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <legend className="sr-only">{labels[m].title}</legend>
                <label htmlFor={`payment-${m}-fee`} className="text-[12px] text-text-muted font-medium shrink-0">
                  {t("payment_fee_label")}
                </label>
                <div className="relative max-w-[140px]">
                  <input
                    id={`payment-${m}-fee`}
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min="0"
                    value={s.fee_pct}
                    onChange={(e) => update(m, { fee_pct: e.target.value })}
                    className="w-full bg-bg-base border border-border-soft rounded-xl pl-3 pr-9 py-2 text-[13px] text-text-base outline-none focus:border-accent transition disabled:opacity-60"
                    placeholder="0"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-text-muted">%</span>
                </div>
                <p className="basis-full text-[11px] text-text-muted sm:basis-auto">{t("payment_fee_hint")}</p>
              </fieldset>

              {/* PayPal.me link + currency — only this method needs them. */}
              {m === "paypal_me" && (
                <fieldset disabled={!s.enabled} className="mt-3 pt-3 border-t border-border-soft">
                  <legend className="sr-only">PayPal.me</legend>
                  <div className="mb-4">
                    <label className="block text-[12px] text-text-muted font-medium mb-1.5">
                      {t("paypal_me_currency_label")}
                    </label>
                    <div className="inline-flex rounded-xl border border-white/10 bg-bg-base p-1">
                      {(["USD", "THB"] as const).map((c) => (
                        <button
                          key={c}
                          type="button"
                          aria-pressed={paypalMeCurrency === c}
                          onClick={() => setPaypalMeCurrency(c)}
                          className={`px-5 py-1.5 rounded-lg text-[12px] font-semibold transition focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60 ${
                            paypalMeCurrency === c
                              ? "bg-accent text-white"
                              : "text-text-muted hover:text-text-base"
                          }`}
                        >
                          {c === "USD" ? "USD ($)" : "THB (฿)"}
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-text-muted italic mt-1">{t("paypal_me_currency_hint")}</p>
                  </div>
                  <label htmlFor="paypal-me-link" className="block text-[12px] text-text-muted font-medium mb-1.5">
                    {t("paypal_me_link_label")}
                  </label>
                  <input
                    id="paypal-me-link"
                    type="url"
                    inputMode="url"
                    value={paypalMeLink}
                    onChange={(e) => setPaypalMeLink(e.target.value)}
                    className="w-full bg-bg-base border border-border-soft rounded-xl px-3 py-2 text-[13px] text-text-base outline-none focus:border-accent transition disabled:opacity-60"
                    placeholder="https://www.paypal.com/paypalme/yourname"
                  />
                  <p className="text-[11px] text-text-muted italic mt-1">{t("paypal_me_link_hint")}</p>
                </fieldset>
              )}
            </div>
          )
        })}

        <div className="flex justify-end pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="min-h-11 w-full sm:w-auto px-6 py-2.5 rounded-xl bg-accent hover:opacity-90 text-white font-bold text-[14px] transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              th ? "บันทึกการชำระเงิน" : "Save payment settings"
            )}
          </button>
        </div>
      </div>
    </section>
  )
}
