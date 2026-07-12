// Affiliate withdrawal emails (English — the audience is largely international).
// Two events:
//   1. Affiliate requests a withdrawal → email admins, CC the affiliate.
//   2. Admin marks it paid          → email the affiliate, CC admins.
// All sends are best-effort via lib/mailer (never break the request).

import { sendMail, getAdminEmails } from "@/lib/mailer"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || ""

const baht = (n: number) => `THB ${n.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

// Shared, email-client-safe HTML shell (inline styles only).
function shell(title: string, bodyRows: string): string {
  return `
  <div style="margin:0;padding:24px;background:#0f1420;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:520px;margin:0 auto;background:#161d2b;border:1px solid #2a3547;border-radius:16px;overflow:hidden;">
      <div style="padding:20px 24px;border-bottom:1px solid #2a3547;">
        <div style="font-size:18px;font-weight:700;color:#e8edf5;">A Class <span style="color:#5b9bd5;">Store</span></div>
      </div>
      <div style="padding:24px;">
        <h1 style="margin:0 0 16px;font-size:18px;color:#e8edf5;">${esc(title)}</h1>
        <table style="width:100%;border-collapse:collapse;font-size:14px;color:#c3ccd9;">${bodyRows}</table>
      </div>
      <div style="padding:16px 24px;border-top:1px solid #2a3547;font-size:12px;color:#7d8899;">
        Automated message from the A Class Store affiliate system. Please do not reply.
      </div>
    </div>
  </div>`
}

function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:6px 0;color:#7d8899;white-space:nowrap;vertical-align:top;">${esc(label)}</td>
    <td style="padding:6px 0 6px 16px;color:#e8edf5;font-weight:600;">${value}</td>
  </tr>`
}

type RequestedInput = {
  affiliateName: string
  affiliateEmail: string | null
  amount: number
  method: string | null
  detail: string | null
}

// Affiliate submitted a withdrawal request → notify admins, CC the affiliate.
export async function sendWithdrawRequestedEmail(input: RequestedInput): Promise<void> {
  const admins = await getAdminEmails()
  if (admins.length === 0) return

  const html = shell("New affiliate withdrawal request", [
    row("Affiliate", esc(input.affiliateName)),
    input.affiliateEmail ? row("Email", esc(input.affiliateEmail)) : "",
    row("Amount", `<span style="color:#5b9bd5;font-size:16px;">${baht(input.amount)}</span>`),
    input.method ? row("Payout method", esc(input.method)) : "",
    input.detail ? row("Account details", esc(input.detail)) : "",
  ].join("") + `<tr><td colspan="2" style="padding-top:16px;">
      <a href="${APP_URL}/admin/affiliates" style="display:inline-block;background:#5b9bd5;color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:600;">Review request</a>
    </td></tr>`)

  await sendMail({
    to: admins,
    cc: input.affiliateEmail ?? undefined,
    subject: `[Affiliate] Withdrawal request ${baht(input.amount)} from ${input.affiliateName}`,
    html,
  })
}

type PaidInput = {
  affiliateName: string
  affiliateEmail: string | null
  amount: number
  method: string | null
}

// Admin marked the request paid → notify the affiliate, CC admins.
export async function sendWithdrawPaidEmail(input: PaidInput): Promise<void> {
  if (!input.affiliateEmail) return
  const admins = await getAdminEmails()

  const html = shell("Your withdrawal has been approved", [
    row("Status", `<span style="color:#4ade80;">Paid</span>`),
    row("Amount", `<span style="color:#5b9bd5;font-size:16px;">${baht(input.amount)}</span>`),
    input.method ? row("Method", esc(input.method)) : "",
  ].join("") + `<tr><td colspan="2" style="padding-top:16px;color:#c3ccd9;">
      Your withdrawal has been transferred. Thank you for being part of A Class Store.
    </td></tr>`)

  await sendMail({
    to: input.affiliateEmail,
    cc: admins.length ? admins : undefined,
    subject: `[Affiliate] Your withdrawal ${baht(input.amount)} has been approved`,
    html,
  })
}
