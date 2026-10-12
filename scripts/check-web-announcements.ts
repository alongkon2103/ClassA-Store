import assert from "node:assert/strict"
import { announcementStatus, nextAnnouncementChange, fromBangkokInput, toBangkokInput } from "../lib/webAnnouncements"
import { parseWebAnnouncement } from "../lib/webAnnouncementValidation"
import { sanitizeAnnouncementHtml } from "../lib/announcementHtml"

const input = {
  title: " Store update ", content: "<h2>News</h2><p>Details</p>", imageUrl: "/uploads/news.webp",
  startsAt: "2026-10-12T09:00:00+07:00", endsAt: "2026-10-12T10:30:00+07:00", enabled: true,
}
const parsed = parseWebAnnouncement(input)
assert.ok("data" in parsed)
const a = parsed.data
assert.equal(a.title, "Store update")
assert.equal(a.startsAt, "2026-10-12T02:00:00.000Z")
for (const [time, expected] of [
  ["2026-10-12T01:59:59Z", "scheduled"], ["2026-10-12T02:00:00Z", "active"],
  ["2026-10-12T03:29:59Z", "active"], ["2026-10-12T03:30:00Z", "expired"],
] as const) assert.equal(announcementStatus(a, Date.parse(time)), expected)
assert.equal(announcementStatus({ ...a, enabled: false }, Date.parse(a.startsAt)), "draft")
assert.equal(announcementStatus({ ...a, endsAt: null }, Date.parse("2028-01-01T00:00:00Z")), "active")
assert.equal(nextAnnouncementChange([a, { ...a, enabled: false, startsAt: "2026-10-12T01:00:00Z" }], Date.parse("2026-10-12T00:00:00Z")), a.startsAt)
assert.equal(nextAnnouncementChange([a], Date.parse(a.startsAt)), a.endsAt)
assert.equal(nextAnnouncementChange([a], Date.parse(a.endsAt!)), null)
for (const invalid of [null, {}, { ...input, title: " " }, { ...input, enabled: "true" },
  { ...input, startsAt: "bad" }, { ...input, startsAt: "2026-10-12T09:00" },
  { ...input, startsAt: "2026-02-30T09:00:00+07:00" }, { ...input, startsAt: "2026-10-12T24:00:00Z" },
  { ...input, endsAt: 0 }, { ...input, imageUrl: false },
  { ...input, endsAt: input.startsAt }, { ...input, endsAt: "2026-10-11T00:00:00Z" },
  { ...input, imageUrl: "javascript:alert(1)" }, { ...input, content: "x".repeat(100_001) },
]) assert.ok("error" in parseWebAnnouncement(invalid), JSON.stringify(invalid)?.slice(0, 150))
assert.equal(fromBangkokInput("2026-10-12T09:00:15"), "2026-10-12T02:00:15.000Z")
assert.equal(toBangkokInput("2026-10-12T02:00:15.000Z"), "2026-10-12T09:00:15")
assert.equal(fromBangkokInput("2026-02-30T09:00:00"), null)
assert.ok("error" in parseWebAnnouncement({ ...input, content: '<p>' + 'a'.repeat(99970) + '</p><img src="/a">' }), "Sanitized content must remain within the readable storage limit")

const html = sanitizeAnnouncementHtml('<h2 style="text-align:center;color:white">News</h2><p><strong>Bold</strong><a href="https://example.com">Link</a></p><img src="/uploads/a.webp" onerror="alert(1)"><table><tr><td colspan="2">Cell</td></tr></table><script>alert(1)</script><svg onload="alert(2)"></svg><img src="javascript:alert(3)"><a href="jav&#x61;script:alert(4)">Bad</a><iframe src="https://evil.test"></iframe>')
assert.ok(html.includes("<strong>Bold</strong>"))
assert.ok(html.includes('src="/uploads/a.webp"'))
assert.ok(html.includes('text-align: center'))
assert.ok(html.includes('colspan="2"'))
assert.ok(!/onerror|onload|<script|<svg|javascript:|evil\.test|color:white/.test(html))
assert.ok(sanitizeAnnouncementHtml('<iframe src="https://www.youtube.com/embed/abc123"></iframe>').includes('https://www.youtube.com/embed/abc123'))
// Tiptap recognizes embedded videos through this wrapper when reopening edits.
const video = sanitizeAnnouncementHtml('<div data-youtube-video=""><iframe src="https://www.youtube.com/embed/abc123"></iframe></div>')
assert.ok(video.includes('data-youtube-video=""'), "Reopening an announcement must preserve its YouTube node")
assert.equal(sanitizeAnnouncementHtml(video), video)
assert.ok(!sanitizeAnnouncementHtml('<iframe src="https://www.youtube.com.evil.test/embed/abc"></iframe>').includes("iframe"))
assert.ok(!sanitizeAnnouncementHtml('<img src="//evil.test/a.png"><img src="data:image/svg+xml,evil"><style>body{display:none}</style>').includes("<img"))
assert.ok(!sanitizeAnnouncementHtml('<a href="/\\evil.test">bad</a>').includes("href"))
console.log("website announcements: schedule, validation, Bangkok times and safe rich content OK")
