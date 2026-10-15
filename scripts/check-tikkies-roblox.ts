import assert from "node:assert/strict"
import { lookupTikkiesRoblox, resolveTikkiesBinding } from "../lib/integrations/tikkiesRoblox"
async function check(){
 let calls=0
 globalThis.fetch=async()=>{calls++;return Response.json({data:[{id:123,name:"OriginalName",displayName:"Original"}]})}
 const bound=await resolveTikkiesBinding("OriginalName");assert.equal(bound.roblox_user_id,"123");assert.equal(calls,1)
 assert.deepEqual(await resolveTikkiesBinding("OriginalName",bound),{});assert.equal(calls,1,"Stored identities are not re-resolved on read/retry")
 globalThis.fetch=async()=>Response.json({id:123,name:"RenamedUser",displayName:"Renamed"})
 assert.equal((await lookupTikkiesRoblox("123",true))?.userId,"123")
 globalThis.fetch=async()=>Response.json({id:124,name:"WrongAccount",displayName:"Wrong"})
 assert.equal(await lookupTikkiesRoblox("123",true),null,"By-ID refresh must never rebind")
 globalThis.fetch=async()=>{throw new Error("offline")}
 assert.equal((await resolveTikkiesBinding("NewAccount")).roblox_user_id,null)
 assert.equal(await lookupTikkiesRoblox("not/an/id",true),null)
 globalThis.fetch=async()=>new Response("",{status:429,headers:{"retry-after":"3"}})
 await assert.rejects(()=>lookupTikkiesRoblox("OriginalName"),/roblox_rate_limited:3/)
 console.log("Tikkies Roblox: persisted bindings, by-ID rename, no identity substitution, outage and rate limits OK")
}
check().catch(e=>{console.error(e);process.exitCode=1})
