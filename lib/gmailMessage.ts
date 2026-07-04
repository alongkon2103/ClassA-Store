// Small helpers to pull headers and decode bodies out of a Gmail API message
// (format="full"). Kept separate from the worker so they're easy to unit-test.

import type { gmail_v1 } from "@googleapis/gmail"

export function getHeader(msg: gmail_v1.Schema$Message, name: string): string {
  const headers = msg.payload?.headers ?? []
  const lower = name.toLowerCase()
  return headers.find((h) => (h.name || "").toLowerCase() === lower)?.value ?? ""
}

// A header can legitimately appear more than once (e.g. Authentication-Results).
export function getHeaderAll(msg: gmail_v1.Schema$Message, name: string): string[] {
  const headers = msg.payload?.headers ?? []
  const lower = name.toLowerCase()
  return headers.filter((h) => (h.name || "").toLowerCase() === lower).map((h) => h.value || "")
}

function decodeB64Url(data?: string | null): string {
  if (!data) return ""
  try {
    return Buffer.from(data, "base64url").toString("utf8")
  } catch {
    return ""
  }
}

// Walk the (possibly multipart) payload and collect the plain-text and HTML bodies.
export function extractBodies(msg: gmail_v1.Schema$Message): { text: string; html: string } {
  let text = ""
  let html = ""
  const walk = (part?: gmail_v1.Schema$MessagePart) => {
    if (!part) return
    const mime = (part.mimeType || "").toLowerCase()
    if (mime === "text/plain") text += decodeB64Url(part.body?.data)
    else if (mime === "text/html") html += decodeB64Url(part.body?.data)
    part.parts?.forEach(walk)
  }
  walk(msg.payload ?? undefined)
  return { text, html }
}
