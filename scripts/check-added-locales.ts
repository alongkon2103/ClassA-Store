import assert from "node:assert/strict"
import { localeTag, dateFnsLocale, variantLabel, OG_LOCALES } from "../lib/i18n/locale"
import { routing } from "../i18n/routing"
import { PAYOUT_CHANNELS, payoutLabel } from "../lib/affiliatePayout"
import { PRIVACY_BY_LOCALE } from "../lib/content/privacy"

for (const locale of ["ko", "vi"]) {
  assert.ok((routing.locales as readonly string[]).includes(locale))
  assert.equal(dateFnsLocale(locale).code, locale)
  const bank = PAYOUT_CHANNELS.find(channel => channel.value === "bank_th")!
  assert.notEqual(payoutLabel(bank, locale), bank.label_en)
  assert.deepEqual(PRIVACY_BY_LOCALE[locale].map(section => section.id), PRIVACY_BY_LOCALE.en.map(section => section.id))
}
assert.equal(localeTag("ko"), "ko-KR")
assert.equal(localeTag("vi"), "vi-VN")
assert.equal(OG_LOCALES.ko, "ko_KR")
assert.equal(OG_LOCALES.vi, "vi_VN")
for (const [locale, lifetime, days, months, years] of [
  ["ko", "평생", "7일", "1개월", "1년"],
  ["vi", "Vĩnh viễn", "7 ngày", "1 tháng", "1 năm"],
]) {
  assert.equal(variantLabel({ duration_type: "permanent" }, locale), lifetime)
  for (const [count, expected] of [[7, days], [30, months], [365, years]] as const)
    assert.equal(variantLabel({ duration_days: count }, locale), expected)
  assert.equal(variantLabel({ label_en: "Custom plan" }, locale), "Custom plan")
}
console.log("PASS Korean/Vietnamese routing, date formats, metadata and package labels")
