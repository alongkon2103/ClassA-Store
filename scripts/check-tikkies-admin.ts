import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { NextRequest, NextResponse } from "next/server"
const require=createRequire(import.meta.url)
const stub=(path:string,exports:unknown)=>{const file=require.resolve(path);require.cache[file]={id:file,filename:file,loaded:true,exports} as NodeModule}
let allowed=true,inTransaction=false,lookups=0,saved:Record<string,unknown>={},updated:{data:Record<string,unknown>;where:{whitelisted_username:{equals:string}}},actorSet=false,providerDown=false
const existing={id:"whitelist-1",ign:"OldAccount",product_id:"game-1",is_premium:false,expires_at:new Date("2027-01-01Z")}
const db={
 products:{findUnique:async()=>{lookups++;return {type:"roblox_whitelist"}},update:async({data}:{data:Record<string,unknown>})=>{saved=data}},
 user_whitelist_access:{findUnique:async()=>{lookups++;return existing},update:async({data}:{data:Record<string,unknown>})=>({...existing,...data})},
 orders:{updateMany:async(args:{data:Record<string,unknown>;where:{whitelisted_username:{equals:string}}})=>{updated=args;return {count:2}}},
 $executeRaw:async()=>{actorSet=true;return 1},
 $transaction:async(fn:(tx:unknown)=>Promise<unknown>)=>{inTransaction=true;try{return await fn(db)}finally{inTransaction=false}},
}
stub("../lib/prisma",{prisma:db})
stub("../lib/adminAuth",{validateAdmin:async(roles:string[])=>{assert.deepEqual(roles,["admin"]);return allowed?{isValid:true,session:{user:{id:"admin-1"}}}:{isValid:false,response:NextResponse.json({error:"Forbidden"},{status:403})}}})
const mapping=require("../app/api/admin/products/[id]/tikkies/route"),whitelist=require("../app/api/admin/whitelist/[id]/route")
const request=(body:unknown)=>new NextRequest("https://store.test/api/admin/test",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify(body)})
const params={params:Promise.resolve({id:"game-1"})}
async function check(){
 allowed=false;assert.equal((await mapping.PATCH(request({universeId:"123",placeIds:["456"]}),params)).status,403);assert.equal((await whitelist.PATCH(request({robloxUserId:"123"}),params)).status,403);assert.equal(lookups,0)
 allowed=true
 for(const bad of [null,[],{universeId:123,placeIds:["456"]},{universeId:null,placeIds:["456"]},{universeId:"123",placeIds:[456]},{universeId:"123",placeIds:["1e5"]}])assert.equal((await mapping.PATCH(request(bad),params)).status,400)
 assert.equal((await mapping.PATCH(request({universeId:"12345678901234567890",placeIds:["456","456","789"]}),params)).status,200)
 assert.equal(saved.roblox_universe_id,"12345678901234567890");assert.deepEqual(saved.roblox_place_ids,["456","789"])
 assert.equal((await mapping.PATCH(request({universeId:null,placeIds:[]}),params)).status,200)
 const realFetch=globalThis.fetch
 globalThis.fetch=async()=>{assert.equal(inTransaction,false,"External lookup cannot hold a DB transaction open");if(providerDown)throw Error("offline");return Response.json({id:123,name:"CanonicalName",displayName:"Player"})}
 try{
  assert.equal((await whitelist.PATCH(request({robloxUserId:123}),params)).status,400)
  assert.equal((await whitelist.PATCH(request({robloxUserId:"123"}),params)).status,200)
  assert.equal(updated.data.roblox_user_id,"123");assert.equal(updated.data.whitelisted_username,"CanonicalName");assert.equal(updated.data.roblox_resolved_for,"canonicalname")
  assert.equal(updated.where.whitelisted_username.equals,"OldAccount");assert.equal(actorSet,true)
  providerDown=true;assert.equal((await whitelist.PATCH(request({robloxUserId:"123"}),params)).status,503)
 }finally{globalThis.fetch=realFetch}
 console.log("Tikkies admin: admin-only mapping/Roblox repair, distinct string IDs, validation, canonical binding and lookup outside transaction OK")
}
check().catch(e=>{console.error(e);process.exitCode=1})
