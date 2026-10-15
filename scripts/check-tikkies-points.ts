import assert from "node:assert/strict"
import { createRequire } from "node:module"
const require=createRequire(import.meta.url)
const stub=(path:string,exports:unknown)=>{const file=require.resolve(path);require.cache[file]={id:file,filename:file,loaded:true,exports} as NodeModule}
type Ledger={user_id:string;delta:number;type:string;order_id:string;base_amount:number}
let status="paid",ledger:Ledger[]=[],notifications=0,queue=Promise.resolve(),pauseCreate:Promise<void>|undefined,creationStarted:()=>void=()=>{}
const order={products:{type:"roblox_whitelist"},id:"o1",user_id:"c1",order_type:"NORMAL",amount:100,goods_amount:80,paid_at:new Date("2026-10-15Z"),created_at:new Date("2026-10-15Z")}
const db={
 system_configs:{findMany:async()=>[{key:"points_enabled",value:"true"},{key:"points_start_at",value:"2026-01-01Z"}]},
 async $transaction(fn:(tx:unknown)=>Promise<unknown>){
  let release:()=>void=()=>{},locked=false
  const tx={
   $queryRaw:async()=>{const before=queue;queue=new Promise<void>(resolve=>{release=resolve});await before;locked=true;return [{id:order.id}]},
   orders:{findUnique:async()=>{assert.ok(locked,"Eligibility must be read after locking the order against refund");return {...order,status}},update:async({data}:{data:{status:string}})=>{assert.ok(locked);status=data.status}},
   point_ledger:{
    findMany:async()=>[...ledger],
    createMany:async({data}:{data:Ledger})=>{assert.ok(locked);creationStarted();if(pauseCreate)await pauseCreate;if(ledger.some(x=>x.type===data.type))return {count:0};ledger.push(data);return {count:1}},
    create:async({data}:{data:Ledger})=>{assert.ok(locked);ledger.push(data)},
   },
  }
  try{return await fn(tx)}finally{locked=false;release()}
 },
}
stub("../lib/prisma",{prisma:db});stub("../lib/notifications",{notify:async()=>{notifications++}})
stub("../lib/affiliateEarnings",{reverseAffiliateEarning:async()=>{}})
const {awardPointsForOrder}=require("../lib/points"),{recordTikkiesReversal}=require("../lib/integrations/tikkiesReversal")
async function check(){
 assert.deepEqual(await awardPointsForOrder(order.id),{points:800,created:true})
 assert.deepEqual(await awardPointsForOrder(order.id),{points:800,created:false})
 assert.equal(notifications,1);assert.equal(ledger.length,1)
 status="refunded";ledger=[];assert.equal(await awardPointsForOrder(order.id),null,"Reversal-first prevents late awards");assert.equal(ledger.length,0)
 status="paid";let resume:()=>void=()=>{}
 pauseCreate=new Promise<void>(resolve=>{resume=resolve})
 const started=new Promise<void>(resolve=>{creationStarted=resolve})
 const earning=awardPointsForOrder(order.id);await started
 const refund=recordTikkiesReversal(order.id,"refunded")
 await Promise.resolve();assert.equal(status,"paid","Refund waits for an in-flight award holding the order lock")
 resume();await Promise.all([earning,refund]);assert.equal(status,"refunded");assert.equal(ledger.reduce((sum,r)=>sum+r.delta,0),0,"Award-first is reversed after its commit")
 await recordTikkiesReversal(order.id,"refunded");assert.equal(ledger.length,2,"Refund replay does not reverse points twice")
 console.log("Purchase points: both refund/award orderings serialized under the order lock, duplicate-safe ledger and replay cleanup OK")
}
check().catch(e=>{console.error(e);process.exitCode=1})
