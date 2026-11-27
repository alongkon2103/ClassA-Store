'use strict';
require('tsx/cjs');
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const {NextRequest}=require('next/server'),{decode,getToken}=require('next-auth/jwt');
const secret='native-store-sso-test-secret-'.repeat(4),key='native-store-sso-integration-fixture-key';
Object.assign(process.env,{NEXTAUTH_URL:'https://aclassstore.com',NEXTAUTH_SECRET:secret,TIKKIES_API_ENABLED:'true',TIKKIES_API_KEY_SHA256:crypto.createHash('sha256').update(key).digest('hex')});
const customer={id:'11111111-1111-4111-8111-111111111111',username:'Stored Discord nickname',email:'owner@example.test',avatar:null,role:'admin',nativeStatus:'ACTIVE'};
const otherCustomer={...customer,id:'22222222-2222-4222-8222-222222222222',email:'other@example.test',role:'user'};
const google={provider:'google',providerAccountId:'verified-google-owner',name:'Google account name',image:'https://lh3.googleusercontent.com/fixture',verifiedEmail:customer.email,verifiedAt:Math.floor(Date.now()/1000)};
const discord={provider:'discord',providerAccountId:'verified-discord-owner',name:'Discord account name',image:'https://cdn.discordapp.com/avatars/fixture.png',verifiedEmail:customer.email,verifiedAt:Math.floor(Date.now()/1000)};
const product={id:'membership',slug:'ac-games-membership',name_th:'สมาชิก',name_en:'Membership',type:'bundle',is_active:true,is_consignment:false,bundle_all_ac_games:true,bundle_includes_tikkies:true,bundle_product_ids:[],product_variants:[{id:'month',price:619,duration_type:'days',duration_days:30,is_active:true,variant_type:'normal',sort_order:0}]};
const offer={code:'bundle:membership:month',priceTHB:619,days:30},codes=new Map(),accounts=new Map();let concurrentOwner=null,uniqueRace=false;
const newCustomers=new Map();let createRace=false;
const accountKey=where=>where.provider_provider_account_id.provider+':'+where.provider_provider_account_id.provider_account_id;
const db={users:{create:async({data})=>{assert.equal(data.role,'user');const row={...data,id:crypto.randomUUID(),nativeStatus:'ACTIVE'};newCustomers.set(row.id,row);if(createRace){createRace=false;throw{code:'P2002'}}return {id:row.id}},findUnique:async({where})=>newCustomers.get(where.id)||(where.id===customer.id?{...customer}:where.id===otherCustomer.id?{...otherCustomer}:null)},products:{findMany:async()=>[product,...['game1','game2'].map(id=>({id,slug:id,name_th:'เกม',name_en:'Game',type:'desktop_program',is_active:true,is_consignment:false,product_images:[]}))]},accounts:{
 findMany:async({where})=>where.OR.flatMap(i=>{const a=accounts.get(i.provider+':'+i.provider_account_id);return a?[a]:[]}),
 findUnique:async({where})=>accounts.get(accountKey(where))||null,
 upsert:async({where,create,update})=>{assert.deepEqual(update,{},'SSO must not overwrite the owner or existing provider tokens');const k=accountKey(where);if(concurrentOwner){accounts.set(k,{user_id:concurrentOwner});concurrentOwner=null;if(uniqueRace){uniqueRace=false;throw{code:'P2002'}}}if(!accounts.has(k))accounts.set(k,{...create});return accounts.get(k)},
},$executeRaw:async(strings,...values)=>{
 if(strings[0].startsWith('INSERT'))codes.set(values[0],{user_id:values[1],challenge:values[2],offer:JSON.parse(values[3]),expires:Date.now()+300000});return 1;
},$queryRaw:async(strings,...values)=>{
 if(strings[0].startsWith('SELECT id'))return values[0]===customer.email?[{id:customer.id}]:[...newCustomers.values()].filter(c=>c.email===values[0]).map(c=>({id:c.id}));
 const row=codes.get(values[0]);if(!row||row.challenge!==values[1]||row.expires<=Date.now())return [];if(strings[0].startsWith('DELETE'))codes.delete(values[0]);return [row];
}};
function stub(name,value){const file=require.resolve(name);require.cache[file]={id:file,filename:file,loaded:true,exports:value};}
stub('../lib/prisma',{prisma:db});
const issue=require('../app/api/integrations/tikkies/checkout/route.ts').POST;
const start=require('../app/api/tikkies/checkout/browser/start/route.ts').POST;
const confirm=require('../app/api/tikkies/checkout/browser/confirm/route.ts').POST;
const {authOptions}=require('../lib/auth');
const request=(path,body,headers={})=>new NextRequest('https://aclassstore.com'+path,{method:'POST',headers:{Origin:'https://aclassstore.com','Content-Type':'application/json',...headers},body:typeof body==='string'?body:JSON.stringify(body)});
const issueFor=(identity,email=customer.email,locale='th')=>issue(request('/api/integrations/tikkies/checkout',{email,offer,locale,...(identity?{identity}:{})},{Authorization:'Bearer '+key}));
async function begin(identity,email,locale='th'){
 const response=await issueFor(identity,email,locale);assert.equal(response.status,200,'trusted native identity is accepted by the store');
 const link=new URL((await response.json()).url);assert.equal(link.pathname,(identity?'/'+locale:locale==='th'?'/th':'')+'/bundles/confirm');const opened=await start(request('/api/tikkies/checkout/browser/start',{ticket:link.hash.slice(8)}));assert.equal(opened.status,200);
 assert.equal(opened.cookies.get('__Secure-next-auth.session-token'),undefined,'preview must not silently replace an existing browser login');
 const preview=await opened.json(),pending=opened.cookies.get('__Secure-tikkies-checkout-pending');
 return {preview,locale,cookie:pending.name+'='+pending.value};
}
const consent=(flow,choice='continue',origin='https://aclassstore.com')=>confirm(request('/api/tikkies/checkout/browser/confirm',new URLSearchParams({nonce:flow.preview.nonce,locale:flow.locale,choice}).toString(),{Origin:origin,Cookie:flow.cookie+'; __Secure-next-auth.session-token.0=previous-browser-chunk','Content-Type':'application/x-www-form-urlencoded'}));
async function main(){
 assert.equal((await issue(request('/api/integrations/tikkies/checkout',{email:customer.email,offer,identity:google}))).status,401);
 for(const bad of [{...google,role:'admin'},{...google,provider:'tikkies'},{...google,providerAccountId:'../../other'},{...google,image:'javascript:alert(1)'}])assert.equal((await issueFor(bad)).status,400);
 const noProof={provider:google.provider,providerAccountId:'unlinked-without-proof',name:google.name,image:google.image};
 for(const unproven of [noProof,{...google,verifiedAt:Math.floor(Date.now()/1000)-903},{...google,verifiedAt:Math.floor(Date.now()/1000)+120},{...google,verifiedEmail:'new-owner@example.test'}]){
  const result=await issueFor(unproven);assert.equal(result.status,403,'historical native email cannot grant a first store binding');assert.equal((await result.json()).error,'identity_verification_required');
 }
 for(const identity of [google,discord]){
  const flow=await begin(identity);assert.equal(flow.preview.account.provider,identity.provider);assert.equal(flow.preview.account.name,identity.name);assert.equal(flow.preview.account.email,customer.email);
  assert.equal((await consent(flow,'continue','https://evil.example')).status,403);
  const response=await consent(flow);assert.equal(response.status,303);assert.equal(response.cookies.get('__Secure-next-auth.session-token.0').maxAge,0);
  const cookie=response.cookies.get('__Secure-next-auth.session-token'),token=await decode({token:cookie.value,secret});
  assert.equal(cookie.maxAge,604800,'normal SSO uses the same seven-day website lifetime');assert.equal(token.id,customer.id);assert.equal(token.provider,identity.provider);assert.equal(token.providerAccountId,identity.providerAccountId);assert.equal(token.role,'admin');assert.equal(token.name,identity.name);assert.equal(token.picture,identity.image);
  assert.equal(token.checkoutExpiresAt,undefined,'ordinary sign-in must not retain the old 15-minute checkout-session limit');
  assert.equal(accounts.get(identity.provider+':'+identity.providerAccountId).user_id,customer.id,'future ordinary OAuth login resolves the same customer');
  const refreshed=await authOptions.callbacks.jwt({token:{...token,roleLastFetched:0}});assert.equal(refreshed.role,'admin');
  const session=await authOptions.callbacks.session({session:{user:{name:token.name,email:token.email,image:token.picture}},token:refreshed});assert.equal(session.user.provider,identity.provider);assert.deepEqual(session.user.checkoutOffer,offer);
  const later=await authOptions.callbacks.session({session:{user:{}},token:{...token,checkoutOfferExpiresAt:1}});assert.equal(later.user.checkoutOffer,undefined,'entry-offer expiry does not end a normal website login');
  const replay=await consent(flow);assert.equal(replay.cookies.get('__Secure-next-auth.session-token'),undefined,'one-use consent cannot log in again');
 }
 assert.equal(accounts.size,2,'Google and Discord belong to the same store customer without duplicate users');
 const durable=await begin({provider:google.provider,providerAccountId:google.providerAccountId,name:google.name,image:google.image},'historical-mailbox@example.test');
 const durableToken=await decode({token:(await consent(durable)).cookies.get('__Secure-next-auth.session-token').value,secret});assert.equal(durableToken.id,customer.id,'durable subject ownership takes precedence over a historical mailbox');assert.equal(durableToken.provider,'google');
 const english=await begin(google,undefined,'en');assert.equal((await consent(english)).headers.get('location'),'https://aclassstore.com/en/bundles/checkout','program language survives the account confirmation redirect');
 const proxy=require('../proxy.ts').default;
 for(const locale of ['en','th']){
  const opposite=locale==='en'?'th':'en',incoming=new NextRequest('https://aclassstore.com/'+locale+'/bundles/confirm',{headers:{Cookie:'NEXT_LOCALE='+opposite,'Accept-Language':opposite}});
  const localized=proxy(incoming);
  if(locale==='en'){
   assert.equal(new URL(localized.headers.get('location')).pathname,'/bundles/confirm','English keeps the website canonical URL convention');
   assert.equal(localized.cookies.get('NEXT_LOCALE')?.value,'en','explicit English overrides a remembered Thai browser language');
   const followed=proxy(new NextRequest('https://aclassstore.com/bundles/confirm',{headers:{Cookie:'NEXT_LOCALE=en','Accept-Language':'th'}}));
   assert.equal(new URL(followed.headers.get('x-middleware-rewrite')).pathname,'/en/bundles/confirm');
  }else assert.equal(new URL(localized.headers.get('x-middleware-rewrite')||incoming.url).pathname,'/th/bundles/confirm');
 }
 customer.avatar='https://cdn.discordapp.com/avatars/stored-old.png';const noPicture=await begin({...google,providerAccountId:'google-no-picture',image:null});assert.equal(noPicture.preview.account.image,null);
 const withoutPicture=await consent(noPicture);assert.equal((await decode({token:withoutPicture.cookies.get('__Secure-next-auth.session-token').value,secret})).picture,null,'a missing Google image must not become the previous Discord profile image');customer.avatar=null;
 const large={...google,providerAccountId:'g'.repeat(255),name:'界'.repeat(200),image:'https://lh3.googleusercontent.com/'+'a'.repeat(1950)};
 const largeFlow=await begin(large);assert.ok(largeFlow.cookie.length<1800,'large profile remains in the server record rather than the pending cookie');
 const largeResponse=await consent(largeFlow),chunks=largeResponse.cookies.getAll().filter(c=>/^__Secure-next-auth\.session-token\.\d+$/.test(c.name)&&c.maxAge>0);
 assert.ok(chunks.length>1,'large ordinary sessions use NextAuth cookie chunks');assert.ok(chunks.every(c=>c.value.length<=3800));
 const requestWithChunks=new NextRequest('https://aclassstore.com/api/auth/session',{headers:{Cookie:chunks.map(c=>c.name+'='+c.value).join('; ')}});
 const joined=await getToken({req:requestWithChunks,secret,secureCookie:true});assert.equal(joined.provider,'google');assert.equal(joined.name,large.name);assert.equal(joined.id,customer.id);
 const conflict={...google,providerAccountId:'another-customer'};accounts.set('google:another-customer',{user_id:otherCustomer.id});otherCustomer.nativeStatus='KICKED';assert.equal((await issueFor(conflict)).status,403,'blocked provider owners cannot sign in through another mailbox');otherCustomer.nativeStatus='ACTIVE';
 otherCustomer.role='admin';const existingOwner=await begin(conflict);const ownerToken=await decode({token:(await consent(existingOwner)).cookies.get('__Secure-next-auth.session-token').value,secret});assert.equal(ownerToken.id,otherCustomer.id,'ordinary SSO signs into the durable subject owner rather than the historical email customer');assert.equal(accounts.get('google:another-customer').user_id,otherCustomer.id);otherCustomer.role='user';
 const race={...google,providerAccountId:'concurrent-link'};const racing=await begin(race);accounts.set('google:concurrent-link',{user_id:'other-customer'});assert.equal((await consent(racing)).cookies.get('__Secure-next-auth.session-token'),undefined);assert.equal(accounts.get('google:concurrent-link').user_id,'other-customer');
 const duringUpsert=await begin({...google,providerAccountId:'race-during-upsert'});concurrentOwner='other-customer';assert.equal((await consent(duringUpsert)).cookies.get('__Secure-next-auth.session-token'),undefined);assert.equal(accounts.get('google:race-during-upsert').user_id,'other-customer');
 const sameOwner=await begin({...google,providerAccountId:'same-owner-race'});concurrentOwner=customer.id;uniqueRace=true;assert.ok((await consent(sameOwner)).cookies.get('__Secure-next-auth.session-token')?.value,'a simultaneous same-customer link recovers from a unique race');
 const declined=await begin(google);assert.equal((await consent(declined,'other')).cookies.get('__Secure-next-auth.session-token'),undefined);
 const legacy=await begin();const old=await consent(legacy),oldToken=await decode({token:old.cookies.get('__Secure-next-auth.session-token').value,secret});assert.equal(oldToken.provider,'tikkies-checkout');assert.equal(oldToken.role,'user');assert.equal(old.cookies.get('__Secure-next-auth.session-token').maxAge,900,'an old checkout-only grant never silently upgrades');
 customer.role='user';const publicFlow=await begin(google);const publicToken=await decode({token:(await consent(publicFlow)).cookies.get('__Secure-next-auth.session-token').value,secret});assert.equal(publicToken.role,'user');customer.nativeStatus='KICKED';assert.equal((await issueFor(google)).status,403);customer.nativeStatus='ACTIVE';customer.role='admin';
 const freshMail='fresh-buyer@example.test',fresh={...google,providerAccountId:'fresh-normal-buyer',verifiedEmail:freshMail};
 const freshFlow=await begin(fresh,freshMail);const freshToken=await decode({token:(await consent(freshFlow)).cookies.get('__Secure-next-auth.session-token').value,secret});assert.equal(freshToken.role,'user');assert.equal(freshToken.email,freshMail);assert.equal(newCustomers.size,1);
 const priorSize=newCustomers.size;const unverified=await issueFor({...fresh,providerAccountId:'unsafe-new-buyer',verifiedAt:1},'untrusted@example.test');assert.equal(unverified.status,403);assert.equal(newCustomers.size,priorSize);
 createRace=true;const racingMail='concurrent-buyer@example.test';const freshRace=await begin({...google,providerAccountId:'concurrent-new-buyer',verifiedEmail:racingMail},racingMail);const raceToken=await decode({token:(await consent(freshRace)).cookies.get('__Secure-next-auth.session-token').value,secret});assert.equal(raceToken.role,'user');assert.equal(raceToken.email,racingMail);
 const sibling={provider:'discord',providerAccountId:'linked-while-confirming'};const beforeRace=await issue(request('/api/integrations/tikkies/checkout',{email:customer.email,offer,locale:'th',identity:google,identities:[{provider:google.provider,providerAccountId:google.providerAccountId},sibling]},{Authorization:'Bearer '+key}));assert.equal(beforeRace.status,200);const raceUrl=new URL((await beforeRace.json()).url),raceStart=await start(request('/api/tikkies/checkout/browser/start',{ticket:raceUrl.hash.slice(8)})),racePreview=await raceStart.json(),raceCookie=raceStart.cookies.get('__Secure-tikkies-checkout-pending');accounts.set('discord:'+sibling.providerAccountId,{user_id:otherCustomer.id});const raceResponse=await consent({preview:racePreview,locale:'th',cookie:raceCookie.name+'='+raceCookie.value});assert.equal(raceResponse.cookies.get('__Secure-next-auth.session-token'),undefined,'a second provider linked elsewhere during consent cannot create a split-principal checkout');assert.ok(raceResponse.headers.get('location').includes('identity_conflict'));
 const conflictReply=await issue(request('/api/integrations/tikkies/checkout',{email:customer.email,offer,locale:'th',identity:google,identities:[{provider:'google',providerAccountId:google.providerAccountId},{provider:'google',providerAccountId:conflict.providerAccountId}]},{Authorization:'Bearer '+key}));assert.equal(conflictReply.status,409);assert.equal((await conflictReply.json()).error,'identity_conflict','known native provider ownership conflicts stop before checkout');
 console.log('PASS normal store SSO: Google/Discord profile and shared customer, real role, seven-day session, short entry offer, consent, provider binding/conflict/race, replay/CSRF and legacy scope');
}
main().catch(error=>{console.error(error);process.exitCode=1});
