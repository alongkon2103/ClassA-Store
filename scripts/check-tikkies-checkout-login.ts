import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {NextRequest} from 'next/server'
import {decode} from 'next-auth/jwt'
import {accountHash,checkoutLoginInput,consumeCheckoutCode,createCheckoutCode} from '../lib/tikkiesCheckoutLogin'

const secret='checkout-qa-secret-not-production-'.repeat(2)
process.env.NEXTAUTH_SECRET=secret;process.env.NEXTAUTH_URL='https://aclassstore.com'
const user={id:'11111111-1111-4111-8111-111111111111',username:'Fixture',email:'fixture@example.test',avatar:null,role:'user',nativeStatus:'ACTIVE'}
let session:any={user:{...user}},writes=0
const codes=new Map<string,{user:string;challenge:string;expires:number;offer:unknown}>()
const db={users:{findUnique:async()=>({...user})},$executeRaw:async(strings:TemplateStringsArray,...values:any[])=>{
 if(strings[0].startsWith('INSERT')){writes++;codes.set(values[0],{user:values[1],challenge:values[2],expires:Date.now()+90000,offer:JSON.parse(values[3])})}return 1
},$queryRaw:async(_strings:TemplateStringsArray,...values:any[])=>{
 const entry=codes.get(values[0]);if(!entry||entry.challenge!==values[1]||entry.expires<=Date.now())return []
 codes.delete(values[0]);return [{user_id:entry.user,offer:entry.offer}]
}}
function stub(name:string,exports:unknown){const file=require.resolve(name);require.cache[file]={id:file,filename:file,loaded:true,exports} as NodeModule}
stub('../lib/prisma',{prisma:db});stub('next-auth',{getServerSession:async()=>session})
const authorize=require('../app/api/tikkies/checkout/authorize/route').POST
const enter=require('../app/api/tikkies/checkout/enter/route').POST
const {authOptions}=require('../lib/auth')
const verifier='v'.repeat(43),challenge=createHash('sha256').update(verifier).digest('base64url')
const offer={code:'bundle:membership:month',priceTHB:669,days:30}
const input={offer:JSON.stringify(offer),state:'s'.repeat(43),challenge,account:accountHash(user.email),callback:'http://127.0.0.1:49777/tikkies-checkout',locale:'th'}
function request(path:string,body:Record<string,string>,origin='https://aclassstore.com',extra={}){return new NextRequest('https://aclassstore.com/api/tikkies/checkout/'+path,{method:'POST',headers:{origin,...extra},body:new URLSearchParams(body)})}
async function main(){
 for(const callback of ['https://evil.test/tikkies-checkout','http://localhost:3000/tikkies-checkout','http://127.0.0.1:80/tikkies-checkout','http://127.0.0.1:49777/other'])assert.throws(()=>checkoutLoginInput(new URLSearchParams({...input,callback})))
 assert.equal((await authorize(request('authorize',input,'https://evil.test'))).status,403);assert.equal(writes,0)
 session=null;assert.equal((await authorize(request('authorize',input))).status,403);session={user:{...user}}
 session.user.provider='tikkies-checkout';assert.equal((await authorize(request('authorize',input))).status,403,'a checkout credential must not mint another approval');delete session.user.provider
 assert.equal((await authorize(request('authorize',{...input,account:'f'.repeat(64)}))).status,403);assert.equal(writes,0)
 const approval=await authorize(request('authorize',input));assert.equal(approval.status,303)
 const callback=new URL(approval.headers.get('location')!);assert.equal(callback.searchParams.get('state'),input.state)
 const code=callback.searchParams.get('code')!
 assert.equal((await enter(request('enter',{code,verifier,locale:'th'},'https://evil.test'))).status,403)
 assert.equal((await enter(request('enter',{code,verifier,locale:'th'},'https://aclassstore.com',{'sec-fetch-site':'cross-site'}))).status,403)
 assert.equal((await enter(request('enter',{code,verifier:'x'.repeat(43),locale:'th'}))).status,401)
 const accepted=await enter(request('enter',{code,verifier,locale:'th'},'https://aclassstore.com',{Cookie:'__Secure-next-auth.session-token.0=old-browser-identity'}));assert.equal(accepted.status,303);assert.equal(accepted.headers.get('location'),'https://aclassstore.com/th/bundles/checkout')
 assert.equal(accepted.cookies.get('__Secure-next-auth.session-token.0')!.maxAge,0,'legacy entry clears older normal cookie chunks')
 const cookie=accepted.cookies.get('__Secure-next-auth.session-token')!
 const decoded=await decode({token:cookie.value,secret});assert.equal(decoded!.id,user.id);assert.equal(decoded!.provider,'tikkies-checkout');assert.equal(decoded!.role,'user');assert.deepEqual(decoded!.checkoutOffer,offer)
 assert.ok(accepted.headers.get('set-cookie')!.includes('HttpOnly'));assert.ok(accepted.headers.get('set-cookie')!.includes('Secure'))
 assert.equal((await enter(request('enter',{code,verifier}))).status,401,'replay denied')
 const renewed=await authOptions.jwt!.encode!({secret,maxAge:30*86400,token:decoded!});const bounded=await decode({token:renewed,secret});assert.ok(Number(bounded!.exp)<=Number(decoded!.checkoutExpiresAt),'renewal cannot extend checkout scope');
 assert.equal(await authOptions.callbacks.jwt({token:{...decoded,checkoutExpiresAt:Math.floor(Date.now()/1000)-1}}),null,'renewed session still has hard expiry')
 const second=await createCheckoutCode(db,user.id,challenge,offer)
 const concurrent=await Promise.all([consumeCheckoutCode(db,second,verifier),consumeCheckoutCode(db,second,verifier)])
 assert.equal(concurrent.filter(Boolean).length,1)
 const third=await createCheckoutCode(db,user.id,challenge,offer);user.nativeStatus='KICKED';assert.equal((await enter(request('enter',{code:third,verifier}))).status,403);user.nativeStatus='ACTIVE'
 assert.equal((await enter(request('enter',{code:'x'.repeat(5000),verifier}))).status,400,'bounded form read')
 console.log('PASS real NextAuth handoff: browser session/account approval, same-origin, PKCE, one use, replay/race, blocked account, secure JWT cookie and immutable expiry')
}
main().catch(error=>{console.error(error);process.exitCode=1})
