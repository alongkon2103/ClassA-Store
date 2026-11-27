import assert from 'node:assert/strict'
import {assertBundleQuote,currentBundleBuyerRole} from '../lib/bundleBuyer'
const quote={code:'bundle:membership:month',priceTHB:669,days:30}
const user={id:'buyer',role:'user',provider:'tikkies-checkout',checkoutOffer:quote}
async function main(){
 assert.doesNotThrow(()=>assertBundleQuote(user,'membership','month',30,669))
 for(const [product,variant,days,price] of [['other','month',30,669],['membership','week',7,129],['membership','month',30,700],['membership','month',60,669]] as const){
  assert.throws(()=>assertBundleQuote(user,product,variant,days,price),/bundle_offer_changed/)
 }
 assert.throws(()=>assertBundleQuote({...user,checkoutOffer:null},'membership','month',30,669),/bundle_offer_changed/)
 assert.throws(()=>assertBundleQuote(user,'membership','month',30,669,'desktop_program'),/bundle_offer_changed/)
 let role='admin',nativeStatus='ACTIVE'
 const db={users:{findUnique:async()=>({role,nativeStatus})}} as never
 assert.equal(await currentBundleBuyerRole(db,user),'admin','only bundle purchase obtains current admin authorization')
 role='user';await assert.rejects(currentBundleBuyerRole(db,user),/bundle_admin_only/)
 role='admin';nativeStatus='KICKED';await assert.rejects(currentBundleBuyerRole(db,user),/bundle_admin_only/)
 console.log('PASS bound checkout quote: exact product, variant, duration, price; current admin role and blocked status')
}
main().catch(error=>{console.error(error);process.exitCode=1})
