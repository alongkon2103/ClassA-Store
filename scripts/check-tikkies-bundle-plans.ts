import assert from 'node:assert/strict'
import {NextRequest} from 'next/server'
import {tikkiesBundlePlans} from '../lib/tikkiesBundlePlans'
const game=(id:string)=>({id,slug:id,name_th:id,name_en:id,type:'desktop_program',is_active:true,is_consignment:false,product_images:[{url:'/uploads/'+id+'.webp'}]})
const offer={id:'offer',slug:'ac-games-membership',name_th:'สมาชิก A Class Games',name_en:'A Class Games membership',type:'bundle',is_active:true,is_consignment:false,bundle_all_ac_games:true,bundle_includes_tikkies:true,bundle_product_ids:[],has_limited_discount:true,product_variants:[{id:'month',price:700,duration_type:'days',duration_days:30,is_active:true,variant_type:'normal',sort_order:0,discount_pct:10,discount_used:0,discount_limit:5}]}
const rows=[offer,game('game1'),game('game2')]
const plans=tikkiesBundlePlans(rows)
assert.equal(plans.length,1);assert.equal(plans[0].priceTHB,630);assert.equal(plans[0].days,30);assert.equal(plans[0].games.length,2)
assert.equal(plans[0].code,'bundle:offer:month');assert.equal(plans[0].includesTikkies,true)
for(const changes of [{bundle_includes_tikkies:false},{is_active:false},{slug:'another-bundle'},{is_consignment:true},{product_variants:[]}])assert.deepEqual(tikkiesBundlePlans([{...offer,...changes},game('game1'),game('game2')]),[])
assert.deepEqual(tikkiesBundlePlans([offer,game('game1')]),[])
assert.equal(tikkiesBundlePlans([{...offer,product_variants:[{...offer.product_variants[0],discount_used:5}]},game('game1'),game('game2')])[0].priceTHB,700)
function stub(name:string,exports:unknown){const file=require.resolve(name);require.cache[file]={id:file,filename:file,loaded:true,exports} as NodeModule}
let authorized=false,reads=0
stub('../lib/integrations/tikkiesSecurity',{authenticateTikkies:()=>{if(!authorized){const {TikkiesError}=require('../lib/integrations/tikkies');throw new TikkiesError('unauthorized',401)}}})
stub('../lib/prisma',{prisma:{products:{findMany:async()=>{reads++;return rows}}}})
const {GET}=require('../app/api/integrations/tikkies/plans/route')
async function main(){
 assert.equal((await GET(new NextRequest('https://aclassstore.com/api/integrations/tikkies/plans'))).status,401);assert.equal(reads,0)
 authorized=true
 const response=await GET(new NextRequest('https://aclassstore.com/api/integrations/tikkies/plans'))
 assert.equal(response.status,200);assert.deepEqual((await response.json()).plans,plans);assert.equal(response.headers.get('cache-control'),'no-store, private')
 assert.equal((await GET(new NextRequest('https://aclassstore.com/api/integrations/tikkies/plans?email=other'))).status,400)
 console.log('PASS private Tikkies bundle catalog: eligibility, current discount, real games, one offer, auth before read, no personal inputs')
}
main().catch(error=>{console.error(error);process.exitCode=1})
