require('tsx/cjs');
const assert=require('node:assert/strict');
let user={id:'fixture',provider:'google',checkoutOffer:{code:'bundle:membership:month',priceTHB:619,days:30}};
const product={id:'membership',slug:'ac-games-membership',name_th:'Membership',name_en:'Membership',type:'bundle',is_active:true,is_consignment:false,bundle_all_ac_games:true,bundle_includes_tikkies:true,bundle_product_ids:[],product_variants:[{id:'month',price:699,duration_type:'days',duration_days:30,is_active:true,variant_type:'normal'}]};
function stub(name,exports){const id=require.resolve(name);require.cache[id]={id,filename:id,loaded:true,exports}}
stub('../lib/prisma',{prisma:{products:{findMany:async()=>[product,...['g1','g2'].map(id=>({id,slug:id,name_th:id,name_en:id,type:'desktop_program',is_active:true,is_consignment:false,product_images:[]}))]}}});
stub('../lib/bundleReviewAccess',{requireBundleBuyerSession:async()=>({user})});stub('../lib/paypal',{getThbToUsdRate:async()=>0.03});stub('next-intl/server',{setRequestLocale:()=>{}});stub('../app/[locale]/bundles/checkout/BundleCheckout',{default:()=>null});
(async()=>{const Page=require('../app/[locale]/bundles/checkout/page').default;const render=from=>Page({params:Promise.resolve({locale:'en'}),searchParams:Promise.resolve({from})});
assert.equal((await render()).props.bundle,null,'native entry detects a changed quote');assert.ok((await render('store')).props.bundle,'ordinary website purchase uses the current catalog regardless of stale native entry offer');
user={...user,provider:'tikkies-checkout'};assert.equal((await render('store')).props.bundle,null,'a public entry flag cannot widen a scoped approval');console.log('PASS membership entry: changed native offer, ordinary public shopping, immutable scoped quote');})().catch(e=>{console.error(e);process.exitCode=1});
