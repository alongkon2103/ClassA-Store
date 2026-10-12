import { parseFragment, serialize, type DefaultTreeAdapterTypes } from "parse5"

export function safeAnnouncementUrl(value: unknown): string | null {
  if (typeof value !== "string") return null
  const url = value.trim()
  if (!url || url.length > 2048 || /[\\\u0000-\u0020\u007f]/.test(url)) return null
  if (url.startsWith("/") && !url.startsWith("//")) return url
  try {
    const parsed = new URL(url)
    return /^https?:$/.test(parsed.protocol) ? url : null
  } catch { return null }
}

const TAGS = new Set("p h1 h2 h3 h4 h5 h6 strong b em i u s strike br hr ul ol li blockquote pre code span div mark table thead tbody tfoot tr th td a img iframe".split(" "))
const DROP_CONTENT = new Set(["script", "style", "template", "noscript", "form", "object", "embed"])
type Parent = DefaultTreeAdapterTypes.ParentNode
type Node = DefaultTreeAdapterTypes.ChildNode

// Parse HTML rather than regexes: encoded URLs and malformed pasted markup must
// pass the same allowlist before being rendered on every visitor's page.
export function sanitizeAnnouncementHtml(html: string): string {
  const fragment = parseFragment(html)
  function clean(parent: Parent, depth = 0) {
    if (depth > 40) { parent.childNodes = []; return }
    const kept: Node[] = []
    for (const node of parent.childNodes) {
      if (node.nodeName === "#text") { kept.push(node); continue }
      if (!("tagName" in node) || node.namespaceURI !== "http://www.w3.org/1999/xhtml" || DROP_CONTENT.has(node.tagName)) continue
      clean(node, depth + 1)
      if (!TAGS.has(node.tagName)) {
        node.childNodes.forEach((child) => { child.parentNode = parent; kept.push(child) })
        continue
      }
      const original = Object.fromEntries(node.attrs.map((a) => [a.name, a.value]))
      const attrs: Record<string, string> = {}
      // Tiptap needs this safe marker to recognize an existing video on edit.
      if (node.tagName === "div" && "data-youtube-video" in original && node.childNodes.some((child) => "tagName" in child && child.tagName === "iframe")) attrs["data-youtube-video"] = ""
      if (node.tagName === "a") {
        const href = safeAnnouncementUrl(original.href)
        if (href) Object.assign(attrs, { href, target: "_blank", rel: "noopener noreferrer" })
      }
      if (node.tagName === "img") {
        const src = safeAnnouncementUrl(original.src)
        if (!src) continue
        Object.assign(attrs, { src, alt: (original.alt ?? "").slice(0, 500), loading: "lazy" })
      }
      if (node.tagName === "iframe") {
        let url: URL
        try { url = new URL(original.src) } catch { continue }
        if (url.protocol !== "https:" || !["www.youtube.com", "www.youtube-nocookie.com"].includes(url.hostname) || !/^\/embed\/[\w-]+$/.test(url.pathname)) continue
        Object.assign(attrs, { src: url.href, title: "YouTube", loading: "lazy", allowfullscreen: "", sandbox: "allow-scripts allow-same-origin allow-presentation", referrerpolicy: "strict-origin-when-cross-origin", style: "width:100%;aspect-ratio:16/9;border:0" })
      }
      if (["p", "h1", "h2", "h3", "h4", "h5", "h6"].includes(node.tagName)) {
        const align = /(?:^|;)\s*text-align\s*:\s*(left|center|right|justify)\s*(?:;|$)/i.exec(original.style ?? "")
        if (align) attrs.style = `text-align: ${align[1].toLowerCase()}`
      }
      if (["td", "th"].includes(node.tagName)) {
        for (const key of ["colspan", "rowspan"]) if (/^[1-9]\d?$/.test(original[key] ?? "")) attrs[key] = original[key]
      }
      node.attrs = Object.entries(attrs).map(([name, value]) => ({ name, value }))
      kept.push(node)
    }
    parent.childNodes = kept
  }
  clean(fragment)
  return serialize(fragment)
}
