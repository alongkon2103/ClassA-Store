import assert from 'node:assert/strict'
import { freezeBundle, parseBundleSnapshot } from '../lib/bundles'

const a='11111111-1111-4111-8111-111111111111', b='22222222-2222-4222-8222-222222222222', p='33333333-3333-4333-8333-333333333333'
const members=[a,b].map(id=>({id,name_th:id,name_en:id,type:'roblox_whitelist',is_active:true,is_consignment:false}))
const db={products:{findMany:async()=>members}}
const product={id:p,type:'bundle',is_active:true,is_consignment:false,bundle_product_ids:[a,b],bundle_includes_tikkies:true}
const variant={id:'v',product_id:p,is_active:true,variant_type:'normal',duration_type:'days',duration_days:30}
async function main(){
  const snapshot=await freezeBundle(db as unknown as Parameters<typeof freezeBundle>[0],product,variant)
  assert.equal((snapshot as unknown as {tikkiesMembership?:boolean}).tikkiesMembership,true,'Full Tikkies membership must be explicitly frozen at checkout')
  assert.equal((parseBundleSnapshot(snapshot) as unknown as {tikkiesMembership?:boolean}).tikkiesMembership,true)
  const old=await freezeBundle(db as unknown as Parameters<typeof freezeBundle>[0],{...product,bundle_includes_tikkies:false},variant)
  assert.equal((old as unknown as {tikkiesMembership?:boolean}).tikkiesMembership,undefined,'Old and game-only bundles never gain full program access')
  assert.throws(()=>parseBundleSnapshot({...snapshot,tikkiesMembership:'true'}))
  const {readTikkiesMembership,parseMembershipRequest}=await import('../lib/integrations/tikkiesMembership')
  const now=new Date('2026-11-23T00:00:00Z'), paid=new Date('2026-11-22T00:00:00Z'), end=new Date('2026-12-22T00:00:00Z')
  let customers=[{id:'buyer',nativeStatus:null as string|null}]
  const make=(extra={})=>({id:'order',status:'paid',order_type:'BUNDLE',bundle_parent_id:null,paid_at:paid,fulfilled_at:paid,expires_at:end,whitelist_status:'whitelisted',bundle_snapshot:snapshot,...extra})
  let orders=[make()]
  const readDb={$queryRaw:async()=>customers,orders:{findMany:async()=>orders}}
  type Client=Parameters<typeof readTikkiesMembership>[0]
  const read=()=>readTikkiesMembership(readDb as unknown as Client,' BUYER@Example.com ',now)
  assert.deepEqual(parseMembershipRequest({email:' BUYER@Example.com '}),{email:'buyer@example.com'})
  for(const input of [{email:null},{email:'bad'},{email:'buyer@example.com',userId:'someone'},{email:'buyer@example.com',productId:a}])assert.throws(()=>parseMembershipRequest(input))
  assert.deepEqual(await read(),{email:'buyer@example.com',allowed:true,expiresAt:end.toISOString()})
  for(const extra of [{status:'pending'},{status:'refunded'},{status:'revoked'},{status:'disputed'},{status:'cancelled'},{paid_at:null},{fulfilled_at:null},{bundle_parent_id:'parent'},{whitelist_status:'revoked'},{expires_at:now},{bundle_snapshot:old},{bundle_snapshot:{...snapshot,durationDays:-1}}]){
    orders=[make(extra)];assert.equal((await read()).allowed,false,JSON.stringify(extra))
  }
  orders=[make({expires_at:new Date('9999-12-31T00:00:00Z')})]
  assert.equal((await read()).expiresAt,end.toISOString(),'Cannot inflate the frozen membership with an unrelated permanent game grant')
  orders=[make({expires_at:new Date(now.getTime()+86400000)}),make({id:'second'})]
  assert.equal((await read()).expiresAt,end.toISOString(),'Overlapping valid memberships preserve the longest access')
  customers=[{id:'buyer',nativeStatus:'KICKED'}];assert.equal((await read()).allowed,false)
  customers=[];assert.equal((await read()).allowed,false)
  customers=[{id:'one',nativeStatus:null},{id:'two',nativeStatus:null}];await assert.rejects(read,/identity_conflict/)
  const identities=[{provider:'google' as const,providerAccountId:'durable-provider'}];let owners=['durable-buyer']
  const boundDb={accounts:{findMany:async()=>owners.map(user_id=>({user_id}))},users:{findUnique:async()=>({id:'durable-buyer',nativeStatus:null})},$queryRaw:async()=>[{id:'historical-email-customer',nativeStatus:null}],orders:{findMany:async({where}:any)=>where.user_id==='durable-buyer'?[make()]:[]}}
  const owned=()=>readTikkiesMembership(boundDb as unknown as Client,'historical@example.com',now,identities)
  assert.equal((await owned()).allowed,true,'membership purchased by the durable SSO owner activates despite a historical native email')
  owners=[];assert.equal((await owned()).allowed,false,'unlinked native subjects cannot fall back to a different historical email customer')
  owners=['durable-buyer','other-customer'];await assert.rejects(owned,/identity_conflict/)
  console.log('PASS explicit frozen full-program grant, legacy denial, lifecycle/overlap, bounded expiry and verified customer identity')
}
main().catch(error=>{console.error(error);process.exitCode=1})
