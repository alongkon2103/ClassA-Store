import assert from "node:assert/strict"
import { createRequire } from "node:module"
const require=createRequire(import.meta.url)
const stub=(path:string,exports:unknown)=>{const file=require.resolve(path);require.cache[file]={id:file,filename:file,loaded:true,exports} as NodeModule}
let status="pending",inside=false,binding:Record<string,unknown>={},grant:{create:{ign:string;expires_at:Date}}|null=null,points=0,quota=0,offline=false,refundDuringLookup=false
const order={id:"o1",user_id:"c1",product_id:"g1",whitelisted_username:"PlayerName",users:null,is_premium_order:false,variant_id:"v1",product_variants:{duration_type:"days",duration_days:3,discount_pct:10,discount_used:0,discount_limit:5},products:{type:"roblox_whitelist",has_limited_discount:true}}
const db={
 orders:{findUnique:async()=>({...order,status,...binding}),update:({where,data}:{where:{status:{notIn:string[]}};data:{status:string;[key:string]:unknown}})=>async()=>{assert.ok(inside);if(where.status.notIn.includes(status))throw Error("concurrent reversal");status=data.status;binding=data}},
 user_whitelist_access:{upsert:(args:{create:{ign:string;expires_at:Date}})=>async()=>{assert.ok(inside);grant=args}},
 product_variants:{update:()=>async()=>{quota++}},
 $transaction:async(ops:(()=>Promise<unknown>)[])=>{inside=true;try{for(const run of ops)await run()}finally{inside=false}},
}
stub("../lib/prisma",{prisma:db});stub("../lib/points",{awardPointsForOrder:async()=>{assert.equal(inside,false);points++}})
stub("../lib/affiliateEarnings",{prepareAffiliateEarning:async()=>null});stub("../lib/notifications",{notify:async()=>{}})
const {fulfillPaidOrder}=require("../lib/orderFulfillment")
const realFetch=globalThis.fetch
async function check(){
 globalThis.fetch=async(url)=>{assert.equal(inside,false,"Roblox lookup must precede the payment transaction");assert.equal(String(url),"https://users.roblox.com/v1/usernames/users");if(refundDuringLookup)status="refunded";if(offline)throw Error("offline");return Response.json({data:[{id:123,name:"PlayerName",displayName:"Player"}]})}
 assert.equal(await fulfillPaidOrder(order.id),"ok");assert.equal(status,"paid");assert.equal(binding.roblox_user_id,"123");assert.equal(binding.roblox_resolved_for,"playername")
 assert.equal(binding.whitelist_status,"whitelisted");assert.equal(grant!.create.ign,"PlayerName");assert.ok(grant!.create.expires_at.getTime()>Date.now());assert.equal(points,1);assert.equal(quota,1)
 assert.equal(await fulfillPaidOrder(order.id),"already_paid");assert.equal(quota,1)
 status="pending";binding={};offline=true;assert.equal(await fulfillPaidOrder(order.id),"ok");assert.equal(binding.roblox_user_id,null,"Roblox failure does not lose the purchase and never guesses identity")
 status="pending";binding={};grant=null;offline=false;refundDuringLookup=true
 await assert.rejects(()=>fulfillPaidOrder(order.id),/concurrent reversal/);assert.equal(status,"refunded");assert.equal(grant,null,"Reversal during external resolution must prevent the grant transaction")
 console.log("Payment fulfillment: saved Roblox IDs, lookup before transaction, purchase/discount/points preservation, outage and concurrent reversal guard OK")
}
check().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{globalThis.fetch=realFetch})
