import assert from 'node:assert/strict'
import {matchesBundleStripePayment} from '../lib/bundlePayment'
const order={id:'order',product_id:'membership',stripe_session_id:'cs_original',amount:669,payment_method:'card'}
const event={id:'cs_original',mode:'payment',payment_status:'paid',currency:'thb',amount_total:66900,metadata:{orderId:'order',productId:'membership'}}
assert.equal(matchesBundleStripePayment(order,event),true)
for(const patch of [{id:'cs_other'},{mode:'subscription'},{payment_status:'unpaid'},{currency:'usd'},{amount_total:66800},{amount_total:67000},{amount_total:null},{metadata:{orderId:'other',productId:'membership'}},{metadata:{orderId:'order',productId:'other'}}])assert.equal(matchesBundleStripePayment(order,{...event,...patch}),false)
assert.equal(matchesBundleStripePayment({...order,stripe_session_id:null},event),false)
assert.equal(matchesBundleStripePayment({...order,payment_method:'bundle'},event),false)
console.log('PASS Stripe membership: exact checkout session, monetary amount, THB currency, payment mode and server order/product binding')
