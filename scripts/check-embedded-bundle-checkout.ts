import assert from 'node:assert/strict'
let authorized=true,reads=0,returnPath='',checkoutUser:any={role:'admin'}
const membershipRow={id:'bundle',slug:'ac-games-membership',name_th:'สมาชิก',name_en:'Membership',type:'bundle',is_active:true,is_consignment:false,bundle_all_ac_games:true,bundle_includes_tikkies:true,product_variants:[{id:'month',price:669,duration_type:'days',duration_days:30,is_active:true,variant_type:'normal'}]}
const rows=[membershipRow,...['one','two'].map(id=>({id,slug:id,name_th:id,name_en:id,type:'desktop_program',is_active:true,is_consignment:false}))]
function stub(name:string,exports:unknown){const file=require.resolve(name);require.cache[file]={id:file,filename:file,loaded:true,exports} as NodeModule}
stub('next-intl/server',{setRequestLocale:()=>{}})
stub('../lib/prisma',{prisma:{products:{findMany:async()=>{reads++;return rows}}}})
stub('../lib/bundleReviewAccess',{requireBundleBuyerSession:async(locale:string)=>{returnPath=locale;if(!authorized)throw Error('forbidden');return {user:checkoutUser}}})
stub('../app/[locale]/bundles/checkout/BundleCheckout',{default:()=>null})
stub('../lib/paypal',{getThbToUsdRate:async()=>0.03})
const {default:Checkout}=require('../app/[locale]/bundles/checkout/page')
async function main(){
 authorized=false;await assert.rejects(Checkout({params:Promise.resolve({locale:'th'})}),/forbidden/);assert.equal(reads,0)
 authorized=true
 const element=await Checkout({params:Promise.resolve({locale:'th'})})
 assert.equal(returnPath,'th');assert.equal(element.props.bundle.id,'bundle');assert.equal(element.props.bundle.product_variants[0].price,669)
 checkoutUser={role:'user',provider:'tikkies-checkout',checkoutOffer:{code:'bundle:bundle:month',priceTHB:669,days:30}}
 membershipRow.product_variants.unshift({...membershipRow.product_variants[0],id:'other',price:129,duration_days:7})
 assert.equal((await Checkout({params:Promise.resolve({locale:'th'})})).props.bundle.product_variants[0].id,'month','variant reordering cannot change the selected offer')
 membershipRow.product_variants[1].price=700
 assert.equal((await Checkout({params:Promise.resolve({locale:'th'})})).props.bundle,null,'price changes require renewed confirmation before the payment form opens')
 checkoutUser={role:'admin'}
 membershipRow.bundle_includes_tikkies=false
 assert.equal((await Checkout({params:Promise.resolve({locale:'en'})})).props.bundle,null)
 console.log('PASS embedded checkout: authorize before read, correct login return, real full-Tikkies offer only, missing offer closed')
}
main().catch(error=>{console.error(error);process.exitCode=1})
