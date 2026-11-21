import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import crypto from "node:crypto"

async function main() {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "tikkies-minecraft-test-"))
  process.env.DESKTOP_PLUGIN_DIR = temporary
  process.env.NEXTAUTH_SECRET = "test-only-download-secret"
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519")
  process.env.LICENCE_PRIVATE_KEY = privateKey.export({ type: "pkcs8", format: "pem" }).toString()
  try {
    const file = path.join(process.cwd(), "lib/integrations/tikkiesMinecraft.ts")
    assert.ok(fs.existsSync(file), "Minecraft needs an entitlement-gated watermarked plugin manifest")
    const { parseMinecraftRequest, issueTikkiesMinecraft } = await import("../lib/integrations/tikkiesMinecraft")
    const { saveBasePlugin, verifyDownload } = await import("../lib/desktopPlugin")
    // Minimal real ZIP/JAR, not a pretend plugin-download response.
    const emptyZip = Buffer.alloc(22); emptyZip.writeUInt32LE(0x06054b50)
    saveBasePlugin("ac_pig_panic", emptyZip, "1.3.9")
    const gameId = "11111111-1111-4111-8111-111111111111", storeId = "22222222-2222-4222-8222-222222222222"
    const now = new Date("2026-11-17T00:00:00Z"), end = new Date("2026-11-17T12:00:00Z")
    let hwid: string | null = null, status = "ACTIVE", expiry = end, nativeStatus: string | null = null, duplicate = false, supported = true, active = true, binds = 0, raced = false, machineTaken = false
    const db = {
      $queryRaw: async () => duplicate ? [{ id: storeId, email: "buyer@example.com", nativeStatus, hwid }, { id: "other" }] : [{ id: storeId, email: "buyer@example.com", nativeStatus, hwid }],
      products: { findFirst: async () => active ? { id: gameId, name_th: "AC Pig Panic", name_en: "AC Pig Panic", program_key: supported ? "ac_pig_panic" : "unknown" } : null },
      user_program_access: { findUnique: async () => ({ status, expires_at: expiry }) },
      users: {
        updateMany: async ({ where, data }: { where: { id: string; hwid: null }; data: { hwid: string } }) => { assert.equal(where.id, storeId); assert.equal(where.hwid, null); if (machineTaken) throw Object.assign(new Error("unique HWID"), { code: "P2002" }); if (raced) { hwid = "racing-machine"; return { count: 0 } }; if (hwid !== null) return { count: 0 }; hwid = data.hwid; binds++; return { count: 1 } },
        findUnique: async () => ({ hwid }),
      },
    }
    const input = { email: " Buyer@Example.com ", productId: gameId, machineId: "machine-12345678" }
    assert.deepEqual(parseMinecraftRequest(input), { ...input, email: "buyer@example.com" })
    for (const bad of [{ ...input, email: null }, { ...input, machineId: "x" }, { ...input, machineId: "bad\nidentity" }, { ...input, productId: "../escape" }, { ...input, url: "https://evil.test" }]) assert.throws(() => parseMinecraftRequest(bad), /invalid_input/)
    const issue = () => issueTikkiesMinecraft(db as never, parseMinecraftRequest(input), now, "https://aclassstore.com")
    const manifest = await issue()
    assert.equal(manifest.gameId, gameId); assert.equal(manifest.licence.account, storeId); assert.equal(manifest.licence.notAfter, "2026-11-17T12:00:00Z")
    assert.deepEqual(manifest.server, { minecraftVersion: "1.21.4", javaMajor: 21, pluginFilename: "ACPigPanic.jar", pluginFolder: "ACPigPanic" })
    const [body, signature] = manifest.licence.token.split(".")
    assert.equal(crypto.verify(null, Buffer.from(body, "base64url"), publicKey, Buffer.from(signature, "base64url")), true)
    assert.match(Buffer.from(body, "base64url").toString(), new RegExp(`^account=${storeId}\\n`))
    const download = new URL(manifest.plugin.url), sp = download.searchParams
    assert.equal(download.origin, "https://aclassstore.com"); assert.equal(sp.get("account"), storeId)
    assert.equal(verifyDownload(storeId, "ac_pig_panic", "1.3.9", Number(sp.get("exp")), sp.get("sig")!), true)
    const cached = fs.readFileSync(path.join(temporary, "ac_pig_panic", "cache", storeId + "-1.3.9.jar"))
    assert.equal(manifest.plugin.sha256, crypto.createHash("sha256").update(cached).digest("hex")); assert.equal(manifest.plugin.size, cached.length)
    assert.ok(cached.includes(Buffer.from(`account=${storeId}\nprogram=ac_pig_panic\n`)))
    assert.equal(binds, 1); await issue(); assert.equal(binds, 1, "same machine must not rebind")
    hwid = "different-machine"; await assert.rejects(issue, /minecraft_device_mismatch/); assert.equal(hwid, "different-machine")
    hwid = null; raced = true; await assert.rejects(issue, /minecraft_device_mismatch/); assert.equal(hwid, "racing-machine"); raced = false
    hwid = null; machineTaken = true; await assert.rejects(issue, /minecraft_device_in_use/); assert.equal(hwid, null); machineTaken = false
    hwid = null; status = "REVOKED"; await assert.rejects(issue, /game_not_owned/); assert.equal(hwid, null, "denied users must not claim a machine")
    status = "ACTIVE"; expiry = now; await assert.rejects(issue, /game_access_expired/)
    expiry = end; nativeStatus = "KICKED"; await assert.rejects(issue, /account_blocked/)
    nativeStatus = null; duplicate = true; await assert.rejects(issue, /identity_conflict/)
    duplicate = false; supported = false; await assert.rejects(issue, /minecraft_not_supported/)
    supported = true; active = false; await assert.rejects(issue, /game_not_found/)
    console.log("PASS Minecraft store: current rights, one machine, account-bound signed licence and real watermarked JAR")
  } finally { fs.rmSync(temporary, { recursive: true, force: true }) }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
