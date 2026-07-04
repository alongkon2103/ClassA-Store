// Inspection tool: list ALL money-related PayPal emails in the mailbox and show
// what our verifier + parser extract from each. Read-only, writes nothing to the
// DB. Use it to confirm we can actually read/parse real PayPal mail.
//
//   npx tsx --env-file=.env scripts/paypal-mail-dump.ts            (default: 90 days, 40 max)
//   npx tsx --env-file=.env scripts/paypal-mail-dump.ts 180 100    (days, max)
//   npx tsx --env-file=.env scripts/paypal-mail-dump.ts 90 40 full (also print masked body)

import { getGmailClient } from "@/lib/gmail"
import { getHeader, getHeaderAll, extractBodies } from "@/lib/gmailMessage"
import { verifyPayPalEmail } from "@/lib/paypalMailVerify"
import { parsePayPalReceivedEmail, htmlToText } from "@/lib/paypalMailParse"

const days = Number(process.argv[2] || 90)
const max = Number(process.argv[3] || 40)
const showBody = process.argv[4] === "full"

// Mask personal data so the output is safe to share.
function mask(s: string): string {
  return s
    .replace(/[\w.+-]+@[\w.-]+\.\w+/g, "<email>")
    .replace(/\+?\d[\d\s().-]{7,}\d/g, "<phone>")
}
function maskName(s: string | null): string {
  if (!s) return "-"
  return s.length <= 2 ? s[0] + "*" : s.slice(0, 2) + "*".repeat(Math.min(6, s.length - 2))
}
function money(amount: number | null, currency: string | null): string {
  const sym = currency === "THB" ? "฿" : currency === "USD" ? "$" : ""
  return `${sym}${amount ?? "?"} ${currency ?? ""}`.trim()
}

// Category from the subject so you can eyeball what's income vs outgoing vs payout.
function category(subject: string): string {
  if (subject.includes("คุณได้รับเงินจำนวน") || subject.includes("ได้รับการชำระเงิน")) return "เงินเข้า (รับ)"
  if (subject.includes("คุณได้ชำระเงินแล้ว") || subject.includes("ใบเสร็จ")) return "จ่ายออก"
  if (subject.includes("โอนเงินไปยังธนาคาร") || subject.includes("ถอนเงิน")) return "ถอนเข้าบัญชี"
  if (subject.includes("คืนเงิน") || subject.includes("refund")) return "คืนเงิน"
  return "อื่น ๆ"
}

async function main() {
  const gmail = getGmailClient()
  const profile = await gmail.users.getProfile({ userId: "me" })
  console.log(`กล่องเมล: ${profile.data.emailAddress} | ช่วง ${days} วันล่าสุด | สูงสุด ${max} ฉบับ\n`)

  // Broad money-related query: received / paid / withdrawal / refund keywords.
  const q =
    `from:paypal.com newer_than:${days}d ` +
    `{subject:"คุณได้รับเงินจำนวน" subject:"ได้รับการชำระเงิน" subject:"คุณได้ชำระเงินแล้ว" ` +
    `subject:"โอนเงินไปยังธนาคาร" subject:"ถอนเงิน" subject:"คืนเงิน" subject:"ใบเสร็จ"}`

  const list = await gmail.users.messages.list({ userId: "me", q, maxResults: max })
  const msgs = list.data.messages ?? []
  console.log(`พบ ${msgs.length} ฉบับ (โดยประมาณรวม ${list.data.resultSizeEstimate ?? "?"})\n`)

  const counts: Record<string, number> = {}
  let verifiedOk = 0
  let parsedOk = 0

  let n = 0
  for (const ref of msgs) {
    if (!ref.id) continue
    n++
    const full = await gmail.users.messages.get({ userId: "me", id: ref.id, format: "full" })
    const msg = full.data
    const subject = getHeader(msg, "Subject")
    const from = getHeader(msg, "From")
    const date = getHeader(msg, "Date")
    const authResults = getHeaderAll(msg, "Authentication-Results")
    const verify = verifyPayPalEmail(from, authResults)
    const { text, html } = extractBodies(msg)
    const parsed = parsePayPalReceivedEmail(subject, text || html)

    const cat = category(subject)
    counts[cat] = (counts[cat] || 0) + 1
    if (verify.ok) verifiedOk++
    if (parsed.ok) parsedOk++

    console.log("────────────────────────────────────────────────────────")
    console.log(`#${n}  [${cat}]  ${date}`)
    console.log(`  หัวข้อ    : ${subject}`)
    console.log(`  ผู้ส่ง    : ${verify.fromEmail}  ${verify.ok ? "(ยืนยัน DKIM/SPF ผ่าน)" : "(ไม่ผ่าน: " + verify.reason + ")"}`)
    if (parsed.ok) {
      console.log(`  แยกข้อมูล : ยอด ${money(parsed.grossAmount, parsed.currency)} | รหัสธุรกรรม ${parsed.txnId} | สถานะ ${parsed.status} | ผู้ส่ง ${maskName(parsed.payerName)}`)
    } else {
      console.log(`  แยกข้อมูล : - (${parsed.reason})`)
    }
    if (showBody) {
      const body = mask(text || htmlToText(html)).slice(0, 600)
      console.log("  เนื้อหา   :\n" + body.split("\n").map((l) => "    " + l).join("\n"))
    }
  }

  console.log("\n================= สรุป =================")
  for (const [k, v] of Object.entries(counts)) console.log(`  ${k}: ${v} ฉบับ`)
  console.log(`  ยืนยันจริง (DKIM/SPF ผ่าน): ${verifiedOk}/${msgs.length}`)
  console.log(`  แยกข้อมูลเงินเข้าได้     : ${parsedOk}/${msgs.length}`)
  console.log("=======================================")
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("เกิดข้อผิดพลาด:", e?.message || e)
    process.exit(1)
  })
