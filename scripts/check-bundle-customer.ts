import assert from 'node:assert/strict'
import {resolveTikkiesCustomer} from '../lib/integrations/tikkiesCustomer'
const identity={provider:'google' as const,providerAccountId:'owned-google'},discord={provider:'discord' as const,providerAccountId:'owned-discord'}
async function main(){
 let owners=['customer-a'],emailReads=0
 const a={id:'customer-a',email:'current@example.test',nativeStatus:'ACTIVE',hwid:null}
 const db:any={accounts:{findMany:async()=>owners.map(user_id=>({user_id}))},users:{findUnique:async({where}:any)=>where.id===a.id?a:null},$queryRaw:async()=>{emailReads++;return [{...a,id:'email-reassigned-customer'}]}}
 for(const ids of [[identity],[discord],[identity,discord]])assert.equal((await resolveTikkiesCustomer(db,'historical@example.test',ids))?.id,a.id)
 assert.equal(emailReads,0);owners=[];assert.equal(await resolveTikkiesCustomer(db,'historical@example.test',[identity]),null);assert.equal(emailReads,0)
 owners=['customer-a','different-customer'];await assert.rejects(resolveTikkiesCustomer(db,'historical@example.test',[identity,discord]),/identity_conflict/)
 assert.equal((await resolveTikkiesCustomer(db,'historical@example.test'))?.id,'email-reassigned-customer','only legacy requests retain email compatibility')
 await assert.rejects(resolveTikkiesCustomer(db,'historical@example.test',[]));console.log('PASS one durable customer for Google/Discord, no historical mailbox fallback and fail-closed conflicts')
}
main().catch(e=>{console.error(e);process.exitCode=1})
