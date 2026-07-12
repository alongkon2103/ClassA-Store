// Outgoing email via Gmail SMTP (App Password). Sending is ALWAYS best-effort:
// a mail failure must never break the action that triggered it (a withdrawal
// request, an admin payout, etc.). Callers await sendMail() after their own DB
// work has committed.
//
// SENDER config (add to .env). The sender is configurable and, by default,
// falls back to the worker's GMAIL_USER account so you only need to add ONE
// value (the app password). Set MAIL_FROM_* only if you want to send from a
// DIFFERENT address than the PayPal worker reads from.
//
//   Simplest (send from the same GMAIL_USER account):
//     GMAIL_APP_PASSWORD   a Google "App Password" (16 chars) for GMAIL_USER
//
//   Separate sender account (independent from the worker):
//     MAIL_FROM            the sending Gmail address, e.g. store@gmail.com
//     MAIL_APP_PASSWORD    app password for THAT account
//     MAIL_FROM_NAME       display name (optional, default "A Class Store")

import nodemailer from "nodemailer"
import { prisma } from "@/lib/prisma"

// Resolved sender: dedicated MAIL_FROM/MAIL_APP_PASSWORD if set, else the
// worker's GMAIL_USER + GMAIL_APP_PASSWORD.
const SENDER_EMAIL = process.env.MAIL_FROM || process.env.GMAIL_USER || ""
const SENDER_PASSWORD = process.env.MAIL_APP_PASSWORD || process.env.GMAIL_APP_PASSWORD || ""
const SENDER_NAME = process.env.MAIL_FROM_NAME || "A Class Store"

let transporter: nodemailer.Transporter | null = null

function getTransporter(): nodemailer.Transporter | null {
  if (!SENDER_EMAIL || !SENDER_PASSWORD) {
    console.warn("mailer: sender not configured — set GMAIL_APP_PASSWORD (or MAIL_FROM + MAIL_APP_PASSWORD). Email disabled.")
    return null
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: SENDER_EMAIL, pass: SENDER_PASSWORD },
    })
  }
  return transporter
}

type MailInput = {
  to: string | string[]
  cc?: string | string[]
  subject: string
  html: string
}

// Send an email. Returns true on success, false on any failure — never throws.
export async function sendMail(input: MailInput): Promise<boolean> {
  const tx = getTransporter()
  const to = Array.isArray(input.to) ? input.to.filter(Boolean) : (input.to ? [input.to] : [])
  const cc = Array.isArray(input.cc) ? input.cc.filter(Boolean) : (input.cc ? [input.cc] : [])
  if (!tx || to.length === 0) return false
  try {
    await tx.sendMail({
      from: `${SENDER_NAME} <${SENDER_EMAIL}>`,
      to,
      cc: cc.length ? cc : undefined,
      subject: input.subject,
      html: input.html,
    })
    return true
  } catch (e) {
    console.error("sendMail failed (non-fatal):", e)
    return false
  }
}

// Emails of every admin (role=admin) with an address on file — recipients for
// affiliate withdrawal notifications.
export async function getAdminEmails(): Promise<string[]> {
  const admins = await prisma.users.findMany({
    where: { role: "admin", email: { not: null } },
    select: { email: true },
  })
  return admins.map((a) => a.email!).filter(Boolean)
}
