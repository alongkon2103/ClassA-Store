import assert from 'node:assert/strict'
let role='user',formReads=0,currentRole='user',nativeStatus='ACTIVE'
const product={id:'membership',type:'bundle',is_active:true,is_consignment:false,bundle_all_ac_games:true,bundle_includes_tikkies:true,product_variants:[{id:'variant',product_id:'membership',is_active:true,variant_type:'normal',duration_type:'days',duration_days:30}]}
function stub(name:string,exports:unknown){const id=require.resolve(name);require.cache[id]={id,filename:id,loaded:true,exports} as NodeModule}
stub('next-auth',{getServerSession:async()=>({user:{id:'buyer',role}})})
stub('../lib/auth',{authOptions:{}})
stub('../lib/prisma',{prisma:{users:{findUnique:async()=>({role:currentRole,nativeStatus})},products:{findUnique:async()=>product,findMany:async()=>['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'].map(id=>({id,type:'roblox_whitelist',name_th:'Fixture',name_en:'Fixture',is_active:true,is_consignment:false}))},orders:{findUnique:async()=>({id:'order',user_id:'buyer',status:'pending',bundle_parent_id:null,products:product})}}})
process.env.STRIPE_SECRET_KEY='sk_test_no_network_membership_fixture'
global.fetch=async()=>{throw Error('No external requests permitted')}
async function main(){
 for(const path of ['../app/api/checkout/route','../app/api/checkout/paypal/route','../app/api/checkout/paypal-me/route','../app/api/checkout/paypal/retry/route']){
  const {POST}=require(path)
  for(const state of [{role:'user',currentRole:'user',nativeStatus:'KICKED'},{role:'admin',currentRole:'admin',nativeStatus:'KICKED'}]){
   role=state.role;currentRole=state.currentRole;nativeStatus=state.nativeStatus
   const response=await POST(new Request('https://store.test/api/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({orderId:'order',productId:'membership',variantId:'variant',whitelistUsername:'Player123',paymentMethod:'card'})}))
   assert.equal(response.status,403,path+' must deny blocked buyers');assert.equal((await response.json()).error,'bundle_account_not_allowed')
  }
  nativeStatus='ACTIVE'
  for(const allowed of ['user','partnership','affiliate']){
   role='user';currentRole=allowed
   const response=await POST(new Request('https://store.test/api/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({orderId:'order',productId:'membership',variantId:'variant',whitelistUsername:'bad username',paymentMethod:'card'})}))
   assert.equal(response.status,400,'active customers reach ordinary validation without contacting providers');assert.equal((await response.json()).error,path.endsWith('/retry/route')?'Not a PayPal order':'bundle_roblox_username_required')
  }
 }
 const {POST}=require('../app/api/orders/[id]/upload-slip/route')
 const response=await POST({formData:async()=>{formReads++;throw Error('Slip must not be read')}} as never,{params:Promise.resolve({id:'order'})})
 assert.equal(response.status,400);assert.equal(formReads,0,'Membership cannot use the legacy slip-payment bypass')
 console.log('PASS real membership: direct checkout/retry APIs deny blocked buyers before provider calls; legacy slip upload cannot grant membership')
}
main().catch(error=>{console.error(error);process.exitCode=1})
