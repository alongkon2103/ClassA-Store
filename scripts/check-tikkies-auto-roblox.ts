import assert from 'node:assert/strict'
import type { Prisma } from '@prisma/client'
import { existsSync } from 'node:fs'
assert.ok(existsSync(new URL('../lib/integrations/tikkiesAutoRoblox.ts',import.meta.url)), 'Legacy purchases need automatic Roblox resolution')
async function check(){
 const {resolvePurchasedAccounts}=await import('../lib/integrations/tikkiesAutoRoblox')
 const row=(id:string,name='PlayerOne')=>({entitlementId:id,status:'account_unresolved',purchasedUsername:name,roblox:{userId:null},revision:1})
 let calls=0, writes:Record<string,any>[]=[], queries:Record<string,any>[]=[], inTransaction=false, available=true, changed=false
 const db={orders:{findMany:async(q:Record<string,any>)=>{queries.push(q);return q.where.id.in.map((id:string)=>({id,whitelisted_username:id==='second'?'PlayerTwo':'PlayerOne',roblox_user_id:null,roblox_resolved_for:null,tikkies_revision:1}))}},$transaction:async(fn:(tx:unknown)=>unknown)=>{inTransaction=true;try{return await fn({orders:{updateMany:async(q:Record<string,any>)=>{writes.push(q);return {count:changed?0:1}}}})}finally{inTransaction=false}}} as unknown as Prisma.TransactionClient & { $transaction: (fn:any)=>Promise<any> }
 globalThis.fetch=async(_url,input)=>{assert.equal(inTransaction,false,'No external lookup may hold a database transaction');calls++;if(!available)throw new Error('offline');const names=JSON.parse(String(input?.body)).usernames;return Response.json({data:names.map((name:string)=>({requestedUsername:name,id:name==='playertwo'?222:111,name:name==='playertwo'?'PlayerTwo':'PlayerOne',displayName:'Player'}))})}
 const snapshot=(customerId:string,entitlements:unknown[])=>({customerId,entitlements})
 assert.equal(await resolvePurchasedAccounts(db,snapshot('c1',[row('first'),row('second','PlayerTwo'),row('duplicate')]) as any),true)
 assert.equal(calls,1,'Multiple purchased names use one batch lookup');assert.equal(writes.length,3)
 assert.equal(queries[0].where.user_id,'c1');assert.equal(queries[0].where.roblox_user_id,null)
 assert.equal(writes[0].where.user_id,'c1');assert.equal(writes[0].where.tikkies_revision,1)
 assert.equal(writes[0].where.whitelisted_username,'PlayerOne');assert.equal(writes[0].where.roblox_user_id,null)
 assert.equal(writes[0].data.roblox_user_id,'111');assert.equal(writes[1].data.roblox_user_id,'222')
 assert.deepEqual(Object.keys(writes[0].data).sort(),['roblox_display_name','roblox_resolved_for','roblox_user_id','roblox_username'])
 const count=writes.length
 for(const status of ['active','expired','refunded','revoked','pending'])await resolvePurchasedAccounts(db,snapshot('status-'+status,[{...row('first'),status}]) as any)
 await resolvePurchasedAccounts(db,snapshot('saved-id',[{...row('first'),roblox:{userId:'999'}}]) as any)
 assert.equal(writes.length,count,'Inactive rights and existing saved IDs must never be rebound')
 available=false;assert.equal(await resolvePurchasedAccounts(db,snapshot('offline',[row('first')]) as any),false)
 const beforeRetry=calls;available=true;await resolvePurchasedAccounts(db,snapshot('offline',[row('first')]) as any);assert.equal(calls,beforeRetry,'Outages are cooled down instead of hammering Roblox')
 changed=true;assert.equal(await resolvePurchasedAccounts(db,snapshot('edited',[row('first')]) as any),false,'Concurrent edits skip the original snapshot')
 globalThis.fetch=async()=>Response.json({data:[{requestedUsername:'OtherAccount',id:333,name:'OtherAccount',displayName:'Other'}]})
 const beforeForged=writes.length;assert.equal(await resolvePurchasedAccounts(db,snapshot('forged',[row('first')]) as any),false);assert.equal(writes.length,beforeForged,'Unrequested identities never bind')
 const realNow=Date.now;let clock=realNow();Date.now=()=>clock
 try {
  const namesSeen:string[][]=[]
  globalThis.fetch=async(_url,input)=>{const names=JSON.parse(String(input?.body)).usernames;namesSeen.push(names);return Response.json({data:names.includes('player50')?[{requestedUsername:'player50',id:550,name:'Player50',displayName:'Last'}]:[]})}
  const manyRows=Array.from({length:51},(_,i)=>row('row-'+i,'Player'+String(i).padStart(2,'0')))
  const manyDb={orders:{findMany:async(q:any)=>q.where.id.in.map((id:string)=>({id,whitelisted_username:'Player'+id.slice(4).padStart(2,'0'),roblox_user_id:null,roblox_resolved_for:null,tikkies_revision:1}))},$transaction:(db as any).$transaction} as any
  changed=false;await resolvePurchasedAccounts(manyDb,snapshot('many',manyRows) as any);clock+=61000
  await resolvePurchasedAccounts(manyDb,snapshot('another-customer',[row('row-0','Player00')]) as any)
  assert.equal(await resolvePurchasedAccounts(manyDb,snapshot('many',manyRows) as any),true,'Later purchases must eventually resolve after earlier names fail')
  assert.ok(namesSeen.at(-1)!.includes('player50'),'Each attempt advances to later purchased names')
 }finally{Date.now=realNow}
 console.log('Tikkies automatic Roblox: purchased names only, batching, ownership scope, stable IDs, CAS, cooldown and outage safety OK')
}
check().catch(e=>{console.error(e);process.exitCode=1})
