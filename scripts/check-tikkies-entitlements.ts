import assert from "node:assert/strict"
import { evaluateTikkiesEntitlement, parseIdentities } from "../lib/integrations/tikkies"
const now = new Date("2026-10-15T12:00:00Z")
const order = { id: "order-a", product_id: "game-a", status: "paid", whitelist_status: "whitelisted", whitelisted_username: "OriginalName", paid_at: now, expires_at: new Date("2026-11-01Z"), tikkies_revision: 1, tikkies_updated_at: now, roblox_user_id: "112233", roblox_username: "RenamedPlayer", roblox_display_name: "Player", roblox_resolved_for: "originalname", products: { id: "game-a", name_en: "Game", type: "roblox_whitelist", roblox_universe_id: "123", roblox_place_ids: ["456"] } }
const access = { ign: "OriginalName", product_id: "game-a", expires_at: new Date("2026-11-01Z") }
assert.deepEqual(parseIdentities({ identities: [{ provider: "google", providerAccountId: "12345678901234567890" }] }), [{ provider: "google", providerAccountId: "12345678901234567890" }])
for (const input of [{email:"x"}, {identities:[]}, {identities:[{provider:"email",providerAccountId:"x"}]}, {identities:[{provider:"google",providerAccountId:123}]}, {identities:new Array(11).fill({provider:"google",providerAccountId:"x"})}]) assert.throws(()=>parseIdentities(input))
for (const provider of [["google"], {toString:"google"}, null, 1]) assert.throws(()=>parseIdentities({identities:[{provider,providerAccountId:"g1"}]}),e=>e instanceof Error && "status" in e && e.status===400)
const check = (patch = {}, whitelist: typeof access | null = access, at = now) => evaluateTikkiesEntitlement({ ...order, ...patch }, whitelist, at)
assert.equal(check().status, "active")
assert.equal(check().gameKey, "game-a")
assert.equal(check().roblox.userId, "112233")
assert.equal(check().roblox.username, "RenamedPlayer", "Renaming preserves the purchased User ID")
assert.equal(check({ status:"pending" }).status,"pending")
assert.equal(check({ status:"refunded" }).status,"refunded")
assert.equal(check({ status:"cancelled" }).status,"revoked")
assert.equal(check({ whitelist_status:"removed" }).status,"revoked")
assert.equal(check({}, null).status,"revoked")
assert.equal(check({ roblox_user_id:null }).status,"account_unresolved")
assert.equal(check({ whitelisted_username:"DifferentAccount" }, {...access,ign:"DifferentAccount"}).status,"account_unresolved")
assert.equal(check({}, {...access,product_id:"other-game"}).status,"revoked")
assert.equal(check({ products: { ...order.products, roblox_universe_id:null } }).status,"pending")
const expired = check({}, access, new Date("2026-11-01Z"))
assert.equal(expired.status,"expired")
assert.ok(expired.revision > check().revision)
assert.equal(expired.updatedAt,"2026-11-01T00:00:00.000Z")
const permanent = new Date("9999-12-31Z")
assert.equal(check({ expires_at:permanent }, { ...access, expires_at:permanent }).expiresAt,null)
console.log("Tikkies entitlement rules: input, paid/pending/refund/revoke/expiry, stable Roblox ID, mapping and revision OK")

import { readTikkiesEntitlements, TikkiesError } from "../lib/integrations/tikkies"
import type { Prisma } from "@prisma/client"
async function customerChecks() {
 const accounts = [{provider:"google",provider_account_id:"g1",user_id:"c1"},{provider:"discord",provider_account_id:"d1",user_id:"c1"},{provider:"discord",provider_account_id:"d2",user_id:"c2"}]
 const db = { accounts:{findMany:async (args:{where:{OR:{provider:string;provider_account_id:string}[]}})=>accounts.filter(a=>args.where.OR.some(i=>i.provider===a.provider&&i.provider_account_id===a.provider_account_id))}, orders:{findMany:async(args:{where:{user_id:string}})=>args.where.user_id==="c1"?[order,{...order,id:"order-b",product_id:"game-b",whitelisted_username:"SecondName",roblox_resolved_for:"secondname",roblox_user_id:"9988",products:{...order.products,id:"game-b"}}]:[]}, user_whitelist_access:{findMany:async()=>[access,{...access,product_id:"game-b",ign:"SecondName"}]}, point_redemptions:{findMany:async()=>[]} } as unknown as Prisma.TransactionClient
 const data = await readTikkiesEntitlements(db,[{provider:"google",providerAccountId:"g1"},{provider:"discord",providerAccountId:"d1"}],now)
 assert.equal(data.customerId,"c1"); assert.deepEqual(data.entitlements.map(e=>e.roblox.userId),["112233","9988"])
 await assert.rejects(()=>readTikkiesEntitlements(db,[{provider:"google",providerAccountId:"g1"},{provider:"discord",providerAccountId:"d2"}],now),e=>e instanceof TikkiesError&&e.code==="identity_conflict")
 await assert.rejects(()=>readTikkiesEntitlements(db,[{provider:"google",providerAccountId:"same-email-but-unlinked"}],now),e=>e instanceof TikkiesError&&e.code==="customer_not_found")
 assert.deepEqual((await readTikkiesEntitlements(db,[{provider:"discord",providerAccountId:"d2"}],now)).entitlements,[])
 assert.equal(JSON.stringify(data).includes("email"),false)
 const originalAccess=db.user_whitelist_access.findMany
 db.user_whitelist_access.findMany=(async()=>[access,access]) as typeof originalAccess
 assert.equal((await readTikkiesEntitlements(db,[{provider:"google",providerAccountId:"g1"}],now)).entitlements[0].status,"active","Duplicate grants must not take the whole customer offline")
 const later={...access,ign:"originalname",expires_at:new Date("2026-12-01Z")}
 const expiredGrant={...access,expires_at:new Date("2026-10-01Z")}
 for(const rows of [[expiredGrant,later],[later,expiredGrant]]) {
  db.user_whitelist_access.findMany=(async()=>rows) as typeof originalAccess
  const rights=(await readTikkiesEntitlements(db,[{provider:"google",providerAccountId:"g1"}],now)).entitlements[0]
  assert.equal(rights.status,"active");assert.equal(rights.expiresAt,order.expires_at.toISOString(),"Whitelist renewal never extends this customer's own order")
  assert.equal(rights.roblox.userId,order.roblox_user_id,"Stored Roblox ownership stays attached to its own order")
 }
 db.user_whitelist_access.findMany=(async()=>[expiredGrant,{...expiredGrant,ign:"ORIGINALNAME"}]) as typeof originalAccess
 assert.equal((await readTikkiesEntitlements(db,[{provider:"google",providerAccountId:"g1"}],now)).entitlements[0].status,"expired")
 db.user_whitelist_access.findMany=(async()=>[{...later,product_id:"another-game"},{...later,ign:"AnotherAccount"}]) as typeof originalAccess
 assert.equal((await readTikkiesEntitlements(db,[{provider:"google",providerAccountId:"g1"}],now)).entitlements[0].status,"revoked","A different game or Roblox name cannot grant rights")
 db.user_whitelist_access.findMany=(async()=>[access,later]) as typeof originalAccess
 const originalOrders=db.orders.findMany
 for(const status of ["refunded","revoked","pending"]) {
  db.orders.findMany=(async()=>[{...order,status}]) as unknown as typeof originalOrders
  assert.equal((await readTikkiesEntitlements(db,[{provider:"google",providerAccountId:"g1"}],now)).entitlements[0].status,status,"Duplicate grants cannot revive an inactive order")
 }
 db.orders.findMany=(async()=>[{...order,expires_at:new Date("2026-10-01Z")}]) as unknown as typeof originalOrders
 assert.equal((await readTikkiesEntitlements(db,[{provider:"google",providerAccountId:"g1"}],now)).entitlements[0].status,"expired","A newer whitelist grant cannot revive an expired order")
 db.orders.findMany=(async()=>[{...order,whitelist_status:"removed"}]) as unknown as typeof originalOrders
 assert.equal((await readTikkiesEntitlements(db,[{provider:"google",providerAccountId:"g1"}],now)).entitlements[0].status,"revoked")
 db.orders.findMany=(async()=>[{...order,expires_at:new Date("9999-12-31Z")}]) as unknown as typeof originalOrders
 assert.equal((await readTikkiesEntitlements(db,[{provider:"google",providerAccountId:"g1"}],now)).entitlements[0].expiresAt,later.expires_at.toISOString(),"Permanent orders are still bounded by current whitelist grants")
 db.user_whitelist_access.findMany=(async()=>[access,{...later,expires_at:new Date("9999-12-31Z")}]) as typeof originalAccess
 assert.equal((await readTikkiesEntitlements(db,[{provider:"google",providerAccountId:"g1"}],now)).entitlements[0].expiresAt,null)
 db.orders.findMany=originalOrders
 db.user_whitelist_access.findMany=originalAccess
 console.log("Tikkies customers: exact Google/Discord identities, no email fallback, conflict, no rights and separate game/account tuples OK")
}
customerChecks().catch(e=>{ console.error(e);process.exitCode=1 })
