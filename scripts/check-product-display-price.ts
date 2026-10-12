import assert from "node:assert/strict"
import { productDisplayPrice } from "../lib/productPrice"

// ราคาแพ็กเกจ 1,280 บาท ที่เรต 0.03 → $38.40 + 6% = $40.70
for (const locale of ["en", "ja", "zh"]) {
  assert.equal(productDisplayPrice(1280, locale, 0.03), 40.7, `${locale}: USD includes 6%`)
  assert.equal(productDisplayPrice(640, locale, 0.03), 20.35, `${locale}: fee applies to the discounted price`)
  assert.equal(productDisplayPrice(1600, locale, 0.03), 50.88, `${locale}: original price uses the same conversion`)
}
assert.equal(productDisplayPrice(1280, "th", 0.03), 1280, "Thai prices stay in baht without the preview fee")
assert.equal(productDisplayPrice(1280, "en", 0.03, 0), 38.4, "Maki prices convert without adding our card fee")
assert.equal(productDisplayPrice(0, "en", 0.03), 0, "zero-price products stay free")
console.log("product display price: OK")
