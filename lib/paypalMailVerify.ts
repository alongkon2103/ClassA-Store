// Authenticity check for incoming PayPal emails — the single most important
// security gate of the whole flow. We ONLY trust an email if Gmail's own
// Authentication-Results header says DKIM and SPF passed AND both the From
// address and the DKIM signing domain belong to the real paypal.com family.
//
// Observed real sender (Thai account): "service@intl.paypal.com", with
//   Authentication-Results: ... dkim=pass header.i=@intl.paypal.com ... spf=pass
//   DKIM-Signature: ... d=intl.paypal.com
// so we must accept paypal.com AND its subdomains (intl.paypal.com), while still
// rejecting lookalikes (paypa1.com, paypal-service.co, paypal.com.evil.com, ...).
//
// The email MUST arrive directly in the inbox — forwarding rewrites these
// headers and would (correctly) fail verification.

export type PayPalVerifyResult = {
  ok: boolean
  reason?: string
  fromEmail: string
  fromDomain: string
}

const PAYPAL_ROOT = "paypal.com"

// true for "paypal.com" and any subdomain "x.paypal.com" — but NOT "notpaypal.com"
// (no leading dot) nor "paypal.com.evil.com" (doesn't end at paypal.com).
export function isPayPalDomain(domain: string): boolean {
  const d = (domain || "").toLowerCase().replace(/\.$/, "").trim()
  return d === PAYPAL_ROOT || d.endsWith("." + PAYPAL_ROOT)
}

export function extractFromEmail(fromHeader: string): string {
  const angle = fromHeader.match(/<([^>]+)>/)
  if (angle) return angle[1].trim().toLowerCase()
  const bare = fromHeader.match(/[^\s"<>]+@[^\s"<>]+/)
  return (bare?.[0] || "").trim().toLowerCase()
}

export function verifyPayPalEmail(
  fromHeader: string,
  authResultsHeaders: string[],
): PayPalVerifyResult {
  const fromEmail = extractFromEmail(fromHeader)
  const fromDomain = fromEmail.split("@")[1] || ""
  const base = { fromEmail, fromDomain }

  if (!isPayPalDomain(fromDomain)) {
    return { ok: false, reason: `From domain "${fromDomain || "?"}" is not paypal.com`, ...base }
  }

  const joined = authResultsHeaders.join(" ;; ").trim()
  if (!joined) {
    return { ok: false, reason: "no Authentication-Results header", ...base }
  }

  if (!/\bdkim\s*=\s*pass\b/i.test(joined)) {
    return { ok: false, reason: "dkim != pass", ...base }
  }
  if (!/\bspf\s*=\s*pass\b/i.test(joined)) {
    return { ok: false, reason: "spf != pass", ...base }
  }

  // Signing domain, from "header.i=@intl.paypal.com" / "header.d=intl.paypal.com" / "d=..."
  const dkimDomain = (
    joined.match(/header\.i=@?([a-z0-9.\-]+)/i)?.[1] ||
    joined.match(/header\.d=([a-z0-9.\-]+)/i)?.[1] ||
    joined.match(/\bd=([a-z0-9.\-]+)/i)?.[1] ||
    ""
  ).toLowerCase()

  if (!isPayPalDomain(dkimDomain)) {
    return { ok: false, reason: `DKIM domain "${dkimDomain || "?"}" is not paypal.com`, ...base }
  }

  return { ok: true, ...base }
}
