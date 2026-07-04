// Parser for PayPal's Thai "money received" email. Written against a REAL sample
// from the mailbox — do not "improve" the labels without checking a real email.
//
// Real structure (HTML only, no text/plain part):
//   Subject: คุณได้รับเงินจำนวน $44.68 USD จาก<payer name>
//   Body (stripped):
//     ID การทำรายการ 0PX99951PE355061U      ← transaction id (≈17 chars)
//     จำนวนเงินที่ได้รับ  $44.68 USD          ← GROSS (what the sender sent) — match on this
//     ค่าธรรมเนียม        $2.43 USD          ← fee
//     รวม                $42.25 USD          ← NET after fee — must NOT be used for matching
//
// We match on GROSS (subject amount / "จำนวนเงินที่ได้รับ"), never on "รวม" (net).
// Other PayPal emails (คุณได้ชำระเงินแล้ว = outgoing, เรากำลังโอนเงินไปยังธนาคาร
// = withdrawal) are correctly rejected as "not a money-received email".

export type PayPalMailStatus = "completed" | "pending" | "unknown"

export type ParsedPayPalPayment = {
  ok: boolean
  reason?: string
  grossAmount: number | null
  currency: string | null
  txnId: string | null
  payerName: string | null
  status: PayPalMailStatus
}

// Markers that this is a "you received money" email (not an outgoing/withdrawal one).
const RECEIVED_MARKERS = ["คุณได้รับเงินจำนวน", "ได้รับการชำระเงินจำนวน"]

// If any of these appear the payment is NOT instantly available — do NOT treat as
// completed (eCheck / on-hold / under review). Kept deliberately specific so the
// generic "อาจต้องรอสักครู่" reassurance line doesn't trip it.
const PENDING_MARKERS =
  /รอดำเนินการ|กำลังดำเนินการ|ยังไม่ได้รับการยืนยัน|ยังไม่พร้อมใช้งาน|อยู่ระหว่างการตรวจสอบ|pending|e-?check|เช็คอิเล็กทรอนิกส์/i

export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#?[a-z0-9]+;/gi, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim()
}

// Matches "$44.68 USD", "44.68 USD", "$1,234.56 USD", "฿594.75 THB". The leading
// currency symbol ($ or ฿) is optional; the authoritative currency is the 3-letter
// code that trails the number.
function parseAmountCurrency(s: string): { amount: number | null; currency: string | null } {
  const m = s.match(/[$฿]?\s*([\d,]+\.\d{2})\s*([A-Z]{3})/)
  if (!m) return { amount: null, currency: null }
  return { amount: Number(m[1].replace(/,/g, "")), currency: m[2] }
}

export function parsePayPalReceivedEmail(subject: string, rawBody: string): ParsedPayPalPayment {
  const body = /<[a-z!][\s\S]*>/i.test(rawBody) ? htmlToText(rawBody) : rawBody
  const empty = {
    grossAmount: null,
    currency: null,
    txnId: null,
    payerName: null,
    status: "unknown" as PayPalMailStatus,
  }

  const isReceived =
    RECEIVED_MARKERS.some((m) => subject.includes(m) || body.includes(m))
  if (!isReceived) {
    return { ok: false, reason: "not a money-received email", ...empty }
  }

  // GROSS + currency — authoritative source is the subject.
  let gross: number | null = null
  let currency: string | null = null
  const subjM = subject.match(/ได้รับเงินจำนวน\s*[$฿]?\s*([\d,]+\.\d{2})\s*([A-Z]{3})/)
  if (subjM) {
    gross = Number(subjM[1].replace(/,/g, ""))
    currency = subjM[2]
  }
  // Fallback: the "จำนวนเงินที่ได้รับ" line (the received/gross line, NOT "รวม").
  if (gross == null) {
    const idx = body.indexOf("จำนวนเงินที่ได้รับ")
    if (idx >= 0) {
      const ac = parseAmountCurrency(body.slice(idx, idx + 80))
      gross = ac.amount
      currency = ac.currency
    }
  }

  // Transaction ID.
  const txnM =
    body.match(/ID\s*การทำรายการ\s*([A-Z0-9]{10,20})/) ||
    body.match(/(?:Transaction\s*ID|หมายเลขธุรกรรม|รหัสธุรกรรม)\s*[:\-]?\s*([A-Z0-9]{10,20})/i)
  const txnId = txnM?.[1] ?? null

  // Payer name — from the subject tail "...USD จาก<name>".
  const payerM = subject.match(/จาก\s*(.+?)\s*$/)
  const payerName = payerM?.[1]?.trim() || null

  const status: PayPalMailStatus = PENDING_MARKERS.test(`${subject}\n${body}`)
    ? "pending"
    : "completed"

  const ok = gross != null && currency != null && !!txnId
  return {
    ok,
    reason: ok ? undefined : "could not extract gross/currency/txnId",
    grossAmount: gross,
    currency,
    txnId,
    payerName,
    status,
  }
}
