import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { NextRequest } from "next/server"
const require = createRequire(import.meta.url)
const stub = (path: string, exports: unknown) => { const file=require.resolve(path); require.cache[file]={id:file,filename:file,loaded:true,exports} as NodeModule }
let status="paid", orderFound=true, writes=0, sharedWrites=0, reversals=0, signatureValid=true, event: unknown
const order={ id:"order-1", product_id:"game-1", whitelisted_username:"Player", user_id:"customer-1", users:{accounts:[]}, products:{type:"roblox_whitelist"} }
const db={
 orders:{findUnique:async()=>orderFound?{...order,status}:null,findFirst:async()=>orderFound?{...order,status}:null,findMany:async()=>[],update:async({data}:{data:{status?:string}})=>{writes++;status=data.status??status;return {...order,status}}},
 user_whitelist_access:{updateMany:async()=>{sharedWrites++;return {count:1}}},
 $queryRaw:async()=>[{id:"shared-grant"}], $executeRaw:async()=>0,
 $transaction:async(fn:(tx:unknown)=>Promise<unknown>)=>{assert.equal(typeof fn,"function","Replayed payment must not grant access");return fn(db)},
}
stub("../lib/prisma",{prisma:db})
stub("../lib/affiliateEarnings",{reverseAffiliateEarning:async()=>{reversals++},prepareAffiliateEarning:async()=>null})
stub("../lib/points",{reversePointsForOrder:async()=>{reversals++},awardPointsForOrder:async()=>null})
stub("../lib/notifications",{notify:async()=>{}})
stub("../lib/discountCodes",{releaseOrderDiscount:async()=>{}})
stub("../lib/stripeCardCountry",{fetchStripeCardCountry:async()=>null})
stub("../lib/paypal",{getPayPalAccessToken:async()=>"test-token"})
stub("next/headers",{headers:async()=>new Headers({"stripe-signature":"test-signature"})})
const stripe={webhooks:{constructEvent:()=>{if(!signatureValid)throw Error("invalid signature");return event}},checkout:{sessions:{list:async()=>({data:[]})}}}
stub("stripe",{__esModule:true,default:class{constructor(){return stripe}}})
process.env.STRIPE_SECRET_KEY="test-key";process.env.PAYPAL_WEBHOOK_ID="test-webhook"
const {recordTikkiesReversal}=require("../lib/integrations/tikkiesReversal")
const {fulfillPaidOrder}=require("../lib/orderFulfillment")
const paypal=require("../app/api/checkout/paypal/webhook/route")
const stripeRoute=require("../app/api/webhook/route")
const request=(data:unknown, signed=true)=>new NextRequest("https://store.test/api/webhook",{method:"POST",headers:{"content-type":"application/json",...(signed?Object.fromEntries(["paypal-auth-algo","paypal-cert-url","paypal-transmission-id","paypal-transmission-sig","paypal-transmission-time"].map(x=>[x,"test"])):{})},body:JSON.stringify(data)})
async function check(){
 await recordTikkiesReversal(order.id,"refunded")
 assert.equal(status,"refunded");assert.equal(writes,1);assert.equal(reversals,2)
 assert.equal(sharedWrites,0,"A refund must preserve independent points/manual grants in the shared whitelist")
 await recordTikkiesReversal(order.id,"refunded");assert.equal(writes,1,"Refund replay cannot rewrite the grant")
 for(const state of ["refunded","revoked","cancelled","disputed","paid"]){status=state;assert.equal(await fulfillPaidOrder(order.id),"already_paid")}
 const realFetch=globalThis.fetch;let verified=true,providerDown=false
 globalThis.fetch=async()=>{if(providerDown)throw Error("provider-down");return Response.json({verification_status:verified?"SUCCESS":"FAILURE"})}
 try{
  const refund={event_type:"PAYMENT.CAPTURE.REFUNDED",resource:{supplementary_data:{related_ids:{capture_id:"capture-1"}}}}
  const before=writes
  assert.equal((await paypal.POST(request(refund,false))).status,401)
  verified=false;assert.equal((await paypal.POST(request(refund))).status,401);assert.equal(writes,before)
  verified=true;providerDown=true;assert.equal((await paypal.POST(request(refund))).status,503);providerDown=false
  orderFound=false;assert.equal((await paypal.POST(request(refund))).status,503,"Refund arriving before capture association must be retried")
  orderFound=true;status="pending";assert.equal((await paypal.POST(request(refund))).status,200);assert.equal(status,"refunded")
  status="paid";assert.equal((await paypal.POST(request({...refund,event_type:"PAYMENT.CAPTURE.REVERSED"}))).status,200);assert.equal(status,"revoked")
 }finally{globalThis.fetch=realFetch}
 event={type:"charge.refunded",data:{object:{payment_intent:"pi-1",amount_refunded:1}}}
 status="paid";signatureValid=false;const before=writes;const log=console.error;console.error=()=>{}
 try{assert.equal((await stripeRoute.POST(request({}))).status,400)}finally{console.error=log}
 assert.equal(writes,before);signatureValid=true
 assert.equal((await stripeRoute.POST(request({}))).status,200);assert.equal(status,"refunded","Even a verified partial refund denies this order")
 status="paid";event={type:"charge.dispute.created",data:{object:{payment_intent:"pi-1"}}};await stripeRoute.POST(request({}));assert.equal(status,"disputed")
 orderFound=false;event={type:"charge.refunded",data:{object:{payment_intent:"pi-1",amount_refunded:100}}};assert.equal((await stripeRoute.POST(request({}))).status,503,"Unmapped verified reversal must not be lost")
 orderFound=true;status="refunded";event={type:"checkout.session.completed",data:{object:{payment_status:"paid",metadata:{orderId:order.id,productId:order.product_id,isUpgrade:"true"}}}}
 assert.equal((await stripeRoute.POST(request({}))).status,200,"Premium payment replay cannot resurrect refunded access");assert.equal(status,"refunded")
 order.products.type="desktop_program";status="paid";const writesBefore=writes
 assert.equal(await recordTikkiesReversal(order.id,"refunded"),false);assert.equal(writes,writesBefore,"Game integration must not alter desktop program orders")
 console.log("Tikkies payments: verified refunds/disputes, retry ordering, independent grants, and terminal replay guards OK")
}
check().catch(e=>{console.error(e);process.exitCode=1})
