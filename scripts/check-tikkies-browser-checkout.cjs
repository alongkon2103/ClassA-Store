'use strict';
// Real Next route handlers and encrypted JWTs; isolated DB, no real account/payment.
require('tsx/cjs');
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const {NextRequest}=require('next/server'),{decode}=require('next-auth/jwt');
const secret='browser-checkout-qa-only-secret-'.repeat(3),key='browser-checkout-integration-fixture-key-20261123';
Object.assign(process.env,{NEXTAUTH_URL:'https://aclassstore.com',NEXTAUTH_SECRET:secret,TIKKIES_API_ENABLED:'true',TIKKIES_API_KEY_SHA256:crypto.createHash('sha256').update(key).digest('hex')});
const account={id:'11111111-1111-4111-8111-111111111111',username:'Native buyer',email:'fixture@example.test',avatar:null,role:'admin',nativeStatus:'ACTIVE'};
const product={id:'membership',slug:'ac-games-membership',name_th:'สมาชิก',name_en:'Membership',type:'bundle',is_active:true,is_consignment:false,bundle_all_ac_games:true,bundle_includes_tikkies:true,bundle_product_ids:[],product_variants:[{id:'month',price:619,duration_type:'days',duration_days:30,is_active:true,variant_type:'normal',sort_order:0}]};
const rows=[product,...['g1','g2'].map(id=>({id,slug:id,name_th:id,name_en:id,type:'desktop_program',is_active:true,is_consignment:false,product_images:[]}))];
const offer={code:'bundle:membership:month',priceTHB:619,days:30},codes=new Map(),linkedAccounts=new Map();let duplicate=false,handoffIdentity,handoffLocale='th';
const db={users:{findUnique:async()=>({...account})},products:{findMany:async()=>rows},accounts:{findMany:async({where})=>where.OR.flatMap(i=>{const a=linkedAccounts.get(JSON.stringify({provider_provider_account_id:{provider:i.provider,provider_account_id:i.provider_account_id}}));return a?[a]:[]}),findUnique:async({where})=>linkedAccounts.get(JSON.stringify(where))||null,upsert:async({where,create})=>{const key=JSON.stringify(where);if(!linkedAccounts.has(key))linkedAccounts.set(key,create);return linkedAccounts.get(key)}},$executeRaw:async(strings,...v)=>{
 if(strings[0].startsWith('INSERT'))codes.set(v[0],{user_id:v[1],challenge:v[2],offer:JSON.parse(v[3]),expires:Date.now()+(strings.join('').includes('5 minutes')?300000:90000)});return 1;
},$queryRaw:async(strings,...v)=>{
 if(strings[0].startsWith('SELECT id'))return duplicate?[{...account},{...account,id:'other'}]:[{...account}];
 const row=codes.get(v[0]);if(!row||row.challenge!==v[1]||row.expires<=Date.now())return [];if(strings[0].startsWith('DELETE'))codes.delete(v[0]);return [row];
}};
function stub(name,value){const file=require.resolve(name);require.cache[file]={id:file,filename:file,loaded:true,exports:value};}
stub('../lib/prisma',{prisma:db});
let issue,start,preview,confirm;
try{issue=require('../app/api/integrations/tikkies/checkout/route.ts').POST;({POST:start,GET:preview}=require('../app/api/tikkies/checkout/browser/start/route.ts'));confirm=require('../app/api/tikkies/checkout/browser/confirm/route.ts').POST;}catch(e){if(e.code!=='MODULE_NOT_FOUND')throw e;}
function req(path,body,headers={},method='POST'){return new NextRequest('https://aclassstore.com'+path,{method,headers:{Origin:'https://aclassstore.com','Content-Type':'application/json',...headers},...(method==='GET'?{}:{body:typeof body==='string'?body:JSON.stringify(body)})});}
const service=body=>issue(req('/api/integrations/tikkies/checkout',body,{Authorization:'Bearer '+key}));
async function ticket(){const r=await service({email:account.email,offer,locale:handoffLocale,...(handoffIdentity?{identity:handoffIdentity}:{})});assert.equal(r.status,200);const data=await r.json(),url=new URL(data.url);assert.equal(url.origin,'https://aclassstore.com');assert.equal(url.pathname,'/'+handoffLocale+'/bundles/confirm');assert.equal(url.search,'');assert.match(url.hash,/^#ticket=[A-Za-z0-9_-]{43}$/);return url.hash.slice(8);}
async function begin(){const raw=await ticket(),r=await start(req('/api/tikkies/checkout/browser/start',{ticket:raw}));assert.equal(r.status,200);assert.equal(r.cookies.get('__Secure-next-auth.session-token'),undefined,'preview must not replace any existing web login');const pending=r.cookies.get('__Secure-tikkies-checkout-pending');assert.ok(pending);assert.match(r.headers.get('set-cookie'),/HttpOnly/);assert.match(r.headers.get('set-cookie'),/Secure/);const data=await r.json();assert.equal(data.account.email,account.email);assert.equal(data.account.name,account.username);assert.deepEqual(data.offer,offer);assert.match(data.nonce,/^[A-Za-z0-9_-]{43}$/);return {raw,data,cookie:pending.name+'='+pending.value};}
const submit=(f,changes={},origin='https://aclassstore.com')=>confirm(req('/api/tikkies/checkout/browser/confirm',new URLSearchParams({nonce:f.data.nonce,locale:'th',choice:'continue',...changes}).toString(),{Cookie:f.cookie,Origin:origin,'Content-Type':'application/x-www-form-urlencoded'}));
async function main(){
 assert.equal(typeof issue,'function','browser ticket route is implemented');
 assert.equal((await issue(req('/api/integrations/tikkies/checkout',{email:account.email,offer}))).status,401);
 assert.equal((await service({email:account.email,offer,asUser:'someone-else'})).status,400);
 duplicate=true;assert.equal((await service({email:account.email,offer})).status,409);duplicate=false;
 account.role='user';assert.equal((await service({email:account.email,offer})).status,200);account.role='admin';
 const f=await begin();assert.equal((await start(req('/api/tikkies/checkout/browser/start',{ticket:f.raw}))).status,401,'ticket replay denied');
 let pendingIsSession=false;try{pendingIsSession=!!await decode({secret,token:f.cookie.slice(f.cookie.indexOf('=')+1)})}catch{}
 assert.equal(pendingIsSession,false,'a pending confirmation cookie must not be a valid NextAuth login credential');
 const restored=await preview(req('/api/tikkies/checkout/browser/start',null,{Cookie:f.cookie},'GET'));assert.equal(restored.status,200);assert.equal((await restored.json()).nonce,f.data.nonce,'reload retains pending confirmation');
 assert.equal((await submit(f,{},'null')).status,403);assert.equal((await submit(f,{nonce:'x'.repeat(43)})).status,403);
 f.cookie+='; __Secure-next-auth.session-token.0=old-part-one; __Secure-next-auth.session-token.1=old-part-two';
 const accepted=await submit(f);assert.equal(accepted.status,303);assert.equal(accepted.headers.get('location'),'https://aclassstore.com/th/bundles/checkout');
 assert.equal(accepted.cookies.get('__Secure-next-auth.session-token.0')?.maxAge,0,'old split-session cookies must not mix with the chosen account');
 const chosen=accepted.cookies.get('__Secure-next-auth.session-token'),jwt=await decode({token:chosen.value,secret});assert.equal(jwt.id,account.id);assert.equal(jwt.role,'user');assert.equal(jwt.provider,'tikkies-checkout');assert.deepEqual(jwt.checkoutOffer,offer);assert.ok(jwt.checkoutExpiresAt<=Math.floor(Date.now()/1000)+900);
 assert.equal((await submit(f)).status,303,'stale confirmation returns a friendly retry page');assert.match((await submit(f)).headers.get('location'),/expired=1/);
 const switched=await begin(),cancel=await submit(switched,{choice:'other'});assert.match(cancel.headers.get('location'),/login\?callbackUrl=/);assert.equal(cancel.cookies.get('__Secure-next-auth.session-token'),undefined,'switch/cancel preserves original browser session');
 const changed=await begin();product.product_variants[0].price=620;const denied=await submit(changed);assert.equal(denied.cookies.get('__Secure-next-auth.session-token'),undefined);assert.match(denied.headers.get('location'),/offer_changed/);product.product_variants[0].price=619;
 const blocked=await begin();account.nativeStatus='KICKED';const no=await submit(blocked);assert.equal(no.cookies.get('__Secure-next-auth.session-token'),undefined);account.nativeStatus='ACTIVE';
 const expired=await ticket();for(const row of codes.values())row.expires=0;assert.equal((await start(req('/api/tikkies/checkout/browser/start',{ticket:expired}))).status,401);
 assert.equal((await start(req('/api/tikkies/checkout/browser/start',{ticket:'x'.repeat(5000)}))).status,400);
 assert.equal((await start(req('/api/tikkies/checkout/browser/start',{ticket:'x'.repeat(43)},{Origin:'https://evil.example'}))).status,403);
 console.log('PASS browser purchase routes: service auth, unique/current admin, no-login preview, one-use/expiry, reload, CSRF, explicit account choice, unchanged web login before consent, price/blocked checks, scoped cookie');
 if(process.argv.includes('--browser'))await chromium();
 if(process.argv.includes('--sso-browser'))for(const [provider,locale] of [['google','th'],['discord','th'],['google','en']]){handoffLocale=locale;handoffIdentity={provider,providerAccountId:'fixture-'+provider,name:provider+' native profile',image:null,verifiedEmail:account.email,verifiedAt:Math.floor(Date.now()/1000)};await chromium();}
}
async function chromium(){
 const puppeteer=require('puppeteer'),esbuild=require('esbuild');
 const bundle=esbuild.buildSync({absWorkingDir:process.cwd(),stdin:{contents:"import React from 'react';import{createRoot}from'react-dom/client';import Confirm from './app/[locale]/bundles/confirm/ConfirmMembership';createRoot(document.getElementById('root')).render(React.createElement(React.StrictMode,null,React.createElement(Confirm,{locale:"+JSON.stringify(handoffLocale)+"})));",resolveDir:process.cwd(),loader:'tsx'},bundle:true,platform:'browser',format:'iife',write:false,define:{'process.env.NODE_ENV':'"development"'},jsx:'automatic'}).outputFiles[0].text;
 const browser=await puppeteer.launch({headless:true,args:['--disable-background-networking']});let starts=0,confirmedHeaders;
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);
  page.on('request',async request=>{
   try{
    const url=new URL(request.url());if(url.origin!=='https://aclassstore.com'){await request.abort();return;}
    if(url.pathname==='/fixture.js'){await request.respond({status:200,contentType:'text/javascript',body:bundle});return;}
    if(url.pathname==='/en/bundles/confirm'||url.pathname==='/en/bundles/checkout'){await request.respond({status:307,headers:{Location:'https://aclassstore.com'+url.pathname.slice(3)+url.search,'Set-Cookie':'NEXT_LOCALE=en; Path=/; SameSite=Lax'}});return;}
    if(url.pathname==='/th/bundles/confirm'||url.pathname==='/bundles/confirm'){await request.respond({status:200,contentType:'text/html',body:'<!doctype html><html><head><meta name="referrer" content="strict-origin"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>'});return;}
    if(url.pathname==='/th/bundles/checkout'||url.pathname==='/bundles/checkout'||url.pathname==='/th/login'){await request.respond({status:200,contentType:'text/html',body:'<h1>Fixture destination</h1>'});return;}
    let response;
    const native=new NextRequest(request.url(),{method:request.method(),headers:request.headers(),...(request.method()==='GET'?{}:{body:request.postData()})});
    if(url.pathname==='/api/tikkies/checkout/browser/start'){if(request.method()==='POST')starts++;response=await(request.method()==='GET'?preview(native):start(native));}
    else if(url.pathname==='/api/tikkies/checkout/browser/confirm'){confirmedHeaders=request.headers();response=await confirm(native);}
    else{await request.respond({status:204});return;}
    const headers=Object.fromEntries(response.headers);const cookies=response.headers.getSetCookie();if(cookies.length)headers['set-cookie']=cookies;
    await request.respond({status:response.status,headers,body:await response.text()});
   }catch(e){errors.push(e.message);await request.respond({status:500,body:'Fixture error'}).catch(()=>{});}
  });
  await page.setCookie({name:'__Secure-next-auth.session-token',value:'existing-different-browser-account',domain:'aclassstore.com',path:'/',secure:true,httpOnly:true});
  await page.setCookie({name:'NEXT_LOCALE',value:handoffLocale==='en'?'th':'en',domain:'aclassstore.com',path:'/'});
  const raw=await ticket();await page.goto('https://aclassstore.com/'+handoffLocale+'/bundles/confirm#ticket='+raw);await page.waitForFunction(()=>document.body.textContent.includes('fixture@example.test'));
  if(handoffIdentity){assert.ok(await page.evaluate(name=>document.body.innerText.includes(name),handoffIdentity.name));assert.ok(await page.evaluate(({prefix,name})=>document.body.innerText.includes(prefix+name),{prefix:handoffLocale==='th'?'เข้าสู่ระบบด้วย ':'Signed in with ',name:handoffIdentity.provider==='google'?'Google':'Discord'}));}
  assert.equal(starts,1,'StrictMode must not consume a ticket twice');assert.equal(new URL(page.url()).hash,'');
  assert.equal((await page.cookies()).find(c=>c.name==='__Secure-next-auth.session-token').value,'existing-different-browser-account','opening confirmation does not change the current browser account');
  const nextTicket=await ticket();await page.evaluate(value=>{location.hash='ticket='+value},nextTicket);
  await page.waitForFunction(()=>location.hash==='',{timeout:1000});assert.equal(starts,2,'a fresh link in the same tab must replace the previous pending confirmation');
  await Promise.all([page.waitForNavigation(),page.click('button[type=submit],form button')]);
  assert.equal(new URL(page.url()).pathname,(handoffLocale==='th'?'/th':'')+'/bundles/checkout');assert.equal(confirmedHeaders.origin,'https://aclassstore.com','real Chromium form preserves Origin');assert.equal(confirmedHeaders.referer,'https://aclassstore.com/');
  if(handoffLocale==='en')assert.equal((await page.cookies()).find(c=>c.name==='NEXT_LOCALE').value,'en','English redirect overrides the old Thai browser preference without losing the ticket');
  const session=(await page.cookies()).find(c=>c.name==='__Secure-next-auth.session-token'),chosen=await decode({token:session.value,secret});assert.equal(chosen.id,account.id,'the explicitly selected native account receives checkout');
  if(handoffIdentity){assert.equal(chosen.provider,handoffIdentity.provider);assert.equal(chosen.name,handoffIdentity.name);assert.equal(chosen.role,account.role);assert.ok(session.expires>Date.now()/1000+6*86400,'ordinary store sign-in persists like normal OAuth');}
  await page.goto('https://aclassstore.com/'+handoffLocale+'/bundles/confirm?expired=1');await page.waitForFunction(()=>document.querySelector('[role=alert]'));
  assert.ok(await page.$eval('[role=alert]',(e,text)=>e.textContent.includes(text),handoffLocale==='th'?'หมดอายุ':'expired'));assert.deepEqual(errors,[]);
  console.log('PASS real Chromium '+(handoffIdentity?.provider||'legacy')+'/'+handoffLocale+': native profile with different browser login, fragment-safe localization, StrictMode single exchange, real form Origin/Referer, explicit sign-in and expired-link UI');
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1});
