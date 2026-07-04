// One-time helper to mint a Gmail API refresh token (scope: gmail.readonly).
//
// Prereqs (see the Thai guide printed by the assistant):
//   1. Google Cloud → enable "Gmail API"
//   2. OAuth consent screen: External, add kamin.phnmanat55@gmail.com as a Test user,
//      add scope .../auth/gmail.readonly
//   3. Create Credentials → OAuth client ID → type "Desktop app"
//   4. Put its client id/secret in .env as GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET
//
// Run:
//   npx tsx --env-file=.env scripts/gmail-auth.ts
//
// It opens a browser, you approve WITH THE MAILBOX ACCOUNT, and it prints the
// GMAIL_REFRESH_TOKEN line to paste back into .env.

import http from "http"
import { exec } from "child_process"
import { auth as googleAuth } from "@googleapis/gmail"

const PORT = 5555
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`
const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]

const clientId = process.env.GMAIL_CLIENT_ID
const clientSecret = process.env.GMAIL_CLIENT_SECRET

if (!clientId || !clientSecret) {
  console.error("❌ ไม่พบ GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET ใน .env — ใส่ให้ครบก่อนรัน")
  process.exit(1)
}

const oauth2 = new googleAuth.OAuth2(clientId, clientSecret, REDIRECT_URI)

const authUrl = oauth2.generateAuthUrl({
  access_type: "offline", // required to receive a refresh_token
  prompt: "consent", // force a fresh refresh_token even if already granted before
  scope: SCOPES,
})

const server = http.createServer(async (req, res) => {
  if (!req.url?.startsWith("/oauth2callback")) {
    res.writeHead(404).end()
    return
  }
  const url = new URL(req.url, `http://localhost:${PORT}`)
  const code = url.searchParams.get("code")
  const error = url.searchParams.get("error")

  if (error || !code) {
    res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" })
    res.end("<h2>❌ ไม่สำเร็จ: " + (error || "no code") + "</h2>")
    server.close()
    process.exit(1)
  }

  try {
    const { tokens } = await oauth2.getToken(code)
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
    res.end("<h2>✅ สำเร็จ! กลับไปที่เทอร์มินอลเพื่อคัดลอก refresh token</h2>")

    console.log("\n──────────────────────────────────────────────")
    if (tokens.refresh_token) {
      console.log("✅ คัดลอกบรรทัดนี้ไปวางทับใน .env:\n")
      console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`)
    } else {
      console.log("⚠️  ไม่ได้ refresh_token กลับมา")
      console.log("   ให้เพิกถอนสิทธิ์แอปที่ https://myaccount.google.com/permissions")
      console.log("   แล้วรันสคริปต์นี้ใหม่ (prompt=consent จะบังคับออก refresh_token)")
    }
    console.log("──────────────────────────────────────────────\n")
  } catch (e: unknown) {
    console.error("❌ แลก token ไม่สำเร็จ:", (e as Error)?.message || e)
  } finally {
    server.close()
    setTimeout(() => process.exit(0), 200)
  }
})

server.listen(PORT, () => {
  const who = process.env.GMAIL_USER || "บัญชีที่รับอีเมล PayPal"
  console.log(`\n🔑 เปิดลิงก์นี้ในเบราว์เซอร์ แล้วล็อกอิน/อนุมัติด้วย: ${who}\n`)
  console.log(authUrl + "\n")
  console.log("(ถ้าเบราว์เซอร์ไม่เด้งขึ้นเอง ให้ก็อปลิงก์ด้านบนไปเปิดเอง)\n")
  // best-effort auto-open on macOS; harmless if it fails
  exec(`open "${authUrl}"`, () => {})
})
