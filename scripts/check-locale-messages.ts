import assert from "node:assert/strict"
import fs from "node:fs"
import { parse, type MessageFormatElement } from "@formatjs/icu-messageformat-parser"

function flatten(value: Record<string, unknown>, prefix = ""): Record<string, string> {
  return Object.fromEntries(Object.entries(value).flatMap(([key, item]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return typeof item === "string" ? [[path, item]] : Object.entries(flatten(item as Record<string, unknown>, path))
  }))
}
function argumentsOf(elements: MessageFormatElement[]): string[] {
  const result = new Set<string>()
  const visit = (nodes: MessageFormatElement[]) => {
    for (const node of nodes) {
      if (node.type !== 0 && node.type !== 7) result.add(`${node.type === 8 ? "tag" : "arg"}:${node.value}`)
      if ("options" in node) for (const option of Object.values(node.options)) visit(option.value)
      if (node.type === 8) visit(node.children)
    }
  }
  visit(elements)
  return [...result].sort()
}
const base = flatten(JSON.parse(fs.readFileSync("messages/en.json", "utf8")))
for (const locale of ["ko", "vi"]) {
  const messages = flatten(JSON.parse(fs.readFileSync(`messages/${locale}.json`, "utf8")))
  assert.deepEqual(Object.keys(messages).sort(), Object.keys(base).sort(), `${locale}: missing/extra translation keys`)
  for (const [key, source] of Object.entries(base)) {
    assert.ok(messages[key].trim(), `${locale}.${key}: empty translation`)
    const options = { ignoreTag: false }
    let sourceAst: MessageFormatElement[]
    try { sourceAst = parse(source, options) } catch { continue /* Existing literal markup is outside ICU. */ }
    assert.deepEqual(argumentsOf(parse(messages[key], options)), argumentsOf(sourceAst), `${locale}.${key}: ICU arguments/tags changed`)
  }
  console.log(`PASS ${locale}: ${Object.keys(messages).length} translation keys, ICU syntax and placeholders`)
}
