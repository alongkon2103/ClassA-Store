// Affiliate payout channels — supports Thai and international affiliates.
// Pure data + helpers (no DB import) so both the client form and the server
// validation/summary use the SAME single source of truth. Add a channel here
// and it appears in the form, validates, and summarises automatically.

export type PayoutFieldDef = {
  key: string
  label_th: string
  label_en: string
  required?: boolean
  placeholder?: string
}

export type PayoutChannel = {
  value: string
  label_th: string
  label_en: string
  fields: PayoutFieldDef[]
}

export const PAYOUT_CHANNELS: PayoutChannel[] = [
  {
    value: "promptpay",
    label_th: "พร้อมเพย์",
    label_en: "PromptPay",
    fields: [
      { key: "account", label_th: "เบอร์/เลขบัตรพร้อมเพย์", label_en: "PromptPay phone/ID", required: true },
      { key: "name", label_th: "ชื่อบัญชี", label_en: "Account name", required: true },
    ],
  },
  {
    value: "bank_th",
    label_th: "ธนาคารไทย",
    label_en: "Thai bank",
    fields: [
      { key: "bank", label_th: "ธนาคาร", label_en: "Bank", required: true },
      { key: "account", label_th: "เลขบัญชี", label_en: "Account number", required: true },
      { key: "name", label_th: "ชื่อบัญชี", label_en: "Account name", required: true },
    ],
  },
  {
    value: "paypal",
    label_th: "PayPal",
    label_en: "PayPal",
    fields: [
      { key: "email", label_th: "อีเมล PayPal", label_en: "PayPal email", required: true },
      { key: "name", label_th: "ชื่อผู้รับ", label_en: "Recipient name", required: true },
    ],
  },
]

export function getChannel(value: string | null | undefined): PayoutChannel | null {
  return PAYOUT_CHANNELS.find((c) => c.value === value) ?? null
}

type Info = Record<string, string>

// Validate that all required fields for the chosen channel are present.
export function validatePayout(
  method: string | null | undefined,
  info: Info | null | undefined,
): { ok: true } | { ok: false; error: string } {
  const channel = getChannel(method)
  if (!channel) return { ok: false, error: "Invalid payout method" }
  const i = info ?? {}
  for (const f of channel.fields) {
    if (f.required && !(typeof i[f.key] === "string" && i[f.key].trim())) {
      return { ok: false, error: `Missing field: ${f.key}` }
    }
  }
  return { ok: true }
}

// Keep only the known fields for the channel, trimmed — nothing extraneous is
// stored, and empty strings become absent.
export function sanitizePayoutInfo(method: string | null | undefined, info: Info | null | undefined): Info {
  const channel = getChannel(method)
  if (!channel) return {}
  const out: Info = {}
  const i = info ?? {}
  for (const f of channel.fields) {
    const v = typeof i[f.key] === "string" ? i[f.key].trim() : ""
    if (v) out[f.key] = v.slice(0, 200)
  }
  return out
}

// One-line human summary for admin display + the payout snapshot, e.g.
// "PayPal · john@example.com" or "SCB · 123-4-56789 · John Doe".
export function summarizePayout(method: string | null | undefined, info: Info | null | undefined): string {
  const channel = getChannel(method)
  if (!channel) return ""
  const i = info ?? {}
  const label = channel.label_en
  const parts = channel.fields.map((f) => i[f.key]).filter((v): v is string => !!v)
  return [label, ...parts].join(" · ")
}
