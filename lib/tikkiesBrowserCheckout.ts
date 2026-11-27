import {resolveTikkiesCustomer} from './integrations/tikkiesCustomer'
import {parseIdentities} from './integrations/tikkies'
import {randomBytes} from 'node:crypto'
import {encode,decode} from 'next-auth/jwt'
import type {Prisma} from '@prisma/client'
import {TikkiesError} from './integrations/tikkies'
import {checkoutQuote,type CheckoutQuote} from './tikkiesCheckoutQuote'
import {codeHash} from './tikkiesCheckoutLogin'
import {tikkiesBundlePlans} from './tikkiesBundlePlans'
import {browserIdentity,browserContext,browserPayload,assertFreshMailbox,type BrowserContext,type BrowserIdentity} from './tikkiesBrowserIdentity'
import {websiteSessionMaxAge,nativeEntryOfferMaxAge} from './authSession'

type Db=Pick<Prisma.TransactionClient,'users'|'products'|'accounts'|'$executeRaw'|'$queryRaw'>
export const browserTicketPurpose='browser-checkout-v1'
const confirmationPurpose='browser-confirm-v1'
const pendingSalt='tikkies-browser-pending-v1'
export const pendingCookie='__Secure-tikkies-checkout-pending'
export const privateHeaders={'Cache-Control':'no-store, private','Referrer-Policy':'no-referrer'}
export function checkoutSite(){
 const site=new URL(process.env.NEXTAUTH_URL||'https://aclassstore.com')
 if(site.protocol!=='https:'||!process.env.NEXTAUTH_SECRET)throw new TikkiesError('checkout_unavailable',503)
 return site
}
export function requireCheckoutOrigin(req:Request){
 if(req.headers.get('origin')!==checkoutSite().origin||req.headers.get('sec-fetch-site')==='cross-site')throw new TikkiesError('forbidden',403)
}
export async function browserBuyer(db:Db,id:string){
 const user=await db.users.findUnique({where:{id},select:{id:true,username:true,email:true,avatar:true,role:true,nativeStatus:true}})
 if(!user||!['user','admin','partnership','affiliate'].includes(user.role)||user.nativeStatus==='KICKED')throw new TikkiesError('account_not_allowed',403)
 return user
}
export async function currentBrowserOffer(db:Db,value:unknown){
 let wanted:CheckoutQuote;try{wanted=checkoutQuote(value)}catch{throw new TikkiesError('invalid_input',400)}
 const rows=await db.products.findMany({
  where:{is_active:true,OR:[{type:'bundle',slug:'ac-games-membership'},{type:{in:['roblox_whitelist','desktop_program']}}],AND:[{OR:[{is_consignment:false},{is_consignment:null}]}]},
  include:{product_images:{orderBy:{sort_order:'asc'}},product_variants:{where:{is_active:true},orderBy:{sort_order:'asc'}}},
  orderBy:[{display_order:'asc'},{created_at:'desc'}],take:502,
 })
 const offer=rows.length>501?null:tikkiesBundlePlans(rows).find(p=>p.code===wanted.code)
 if(!offer||offer.days!==wanted.days||Math.round(offer.priceTHB*100)!==Math.round(wanted.priceTHB*100))throw new TikkiesError('offer_changed',409)
 return wanted
}
function accountKey(identity:BrowserIdentity){return {provider_provider_account_id:{provider:identity.provider,provider_account_id:identity.providerAccountId}}}
async function checkIdentityOwner(db:Db,userId:string,identity:BrowserIdentity){
 const account=await db.accounts.findUnique({where:accountKey(identity),select:{user_id:true}})
 if(account&&account.user_id!==userId)throw new TikkiesError('identity_conflict',409)
 return account
}
function accountPreview(user:Awaited<ReturnType<typeof browserBuyer>>,context:BrowserContext){
 return {name:context.identity?context.identity.name??user.email:user.username,email:user.email,image:context.identity?context.identity.image:user.avatar,...(context.identity?{provider:context.identity.provider}:{})}
}
/** Trusted native OAuth proof only. Call in a transaction; never issue a browser session. */
export async function ensureNativeStoreCustomer(db:Db,identityValue:unknown,ownedIdentityValues:unknown){
 const identity=browserIdentity(identityValue),identities=parseIdentities({identities:ownedIdentityValues})
 if(!identities.some(i=>i.provider===identity.provider&&i.providerAccountId===identity.providerAccountId))throw new TikkiesError('invalid_input',400)
 const owned=await resolveTikkiesCustomer(db,null,identities)
 const linked=await db.accounts.findUnique({where:accountKey(identity),select:{user_id:true}})
 if(linked)return browserBuyer(db,linked.user_id)
 const email=identity.verifiedEmail??null
 assertFreshMailbox(identity,email)
 const matches=await db.$queryRaw<{id:string}[]>`SELECT id FROM users WHERE lower(btrim(email))=${email!} LIMIT 2`
 if(matches.length>1||owned&&!matches.some(row=>row.id===owned.id))throw new TikkiesError('identity_conflict',409)
 const id=matches[0]?.id??(await db.users.create({data:{email,username:identity.name??email!,avatar:identity.image,role:'user'},select:{id:true}})).id
 const user=await browserBuyer(db,id)
 const account=await db.accounts.upsert({where:accountKey(identity),create:{user_id:user.id,provider:identity.provider,provider_account_id:identity.providerAccountId},update:{},select:{user_id:true}})
 if(account.user_id!==user.id)throw new TikkiesError('identity_conflict',409)
 return user
}
export async function issueBrowserCheckout(db:Db,email:string,offer:unknown,locale:string,identityValue?:unknown,ownedIdentityValues?:unknown){
 const identity=identityValue===undefined?undefined:browserIdentity(identityValue)
 const identities=identity?parseIdentities({identities:ownedIdentityValues===undefined?[{provider:identity.provider,providerAccountId:identity.providerAccountId}]:ownedIdentityValues}):undefined
 if(ownedIdentityValues!==undefined&&!identity)throw new TikkiesError('invalid_input',400)
 if(identity&&!identities!.some(i=>i.provider===identity.provider&&i.providerAccountId===identity.providerAccountId))throw new TikkiesError('invalid_input',400)
 const ownedCustomer=identities?await resolveTikkiesCustomer(db,email,identities):null
 const linked=identity?await db.accounts.findUnique({where:accountKey(identity),select:{user_id:true}}):null
 if(identity&&!linked)assertFreshMailbox(identity,email)
 let customers=linked?[{id:linked.user_id}]:await db.$queryRaw<{id:string}[]>`SELECT id FROM users WHERE lower(btrim(email))=${email.trim().toLowerCase()} LIMIT 2`
 if(customers.length>1)throw new TikkiesError('identity_conflict',409)
 if(ownedCustomer&&!customers.some(c=>c.id===ownedCustomer.id))throw new TikkiesError('identity_conflict',409)
 if(!customers.length&&identity){
  // Only fresh provider-verified mailbox evidence can provision an ordinary customer.
  assertFreshMailbox(identity,email)
  try{const created=await db.users.create({data:{email:email.trim().toLowerCase(),username:identity.name??email.trim().toLowerCase(),avatar:identity.image,role:'user'},select:{id:true}});customers=[created]}
  catch(error){
   if(!error||typeof error!=='object'||!('code' in error)||error.code!=='P2002')throw error
   customers=await db.$queryRaw<{id:string}[]>`SELECT id FROM users WHERE lower(btrim(email))=${email.trim().toLowerCase()} LIMIT 2`
  }
 }
 if(customers.length!==1)throw new TikkiesError(customers.length>1?'identity_conflict':'account_not_allowed',403)
 if(ownedCustomer&&customers.length===1&&ownedCustomer.id!==customers[0].id)throw new TikkiesError('identity_conflict',409)
 const user=await browserBuyer(db,customers[0].id),quote=await currentBrowserOffer(db,offer)
 if(identity)await checkIdentityOwner(db,user.id,identity)
 const ticket=randomBytes(32).toString('base64url'),hash=codeHash(ticket),payload=browserPayload({offer:quote,identity,identities})
 await db.$executeRaw`INSERT INTO tikkies_checkout_codes (code_hash,user_id,challenge,offer,expires_at) VALUES (${hash},${user.id}::uuid,${browserTicketPurpose},${JSON.stringify(payload)}::jsonb,clock_timestamp()+interval '90 seconds')`
 await db.$executeRaw`DELETE FROM tikkies_checkout_codes WHERE code_hash IN (SELECT code_hash FROM tikkies_checkout_codes WHERE expires_at < clock_timestamp() LIMIT 100)`
 const prefix=locale==='th'?'/th':identity?'/en':'' // Keep the old English broker compatible during rollout.
 const url=new URL(prefix+'/bundles/confirm',checkoutSite());url.hash='ticket='+ticket
 return {url:url.href,expiresInSec:90}
}
export async function consumeBrowserCode(db:Db,raw:string,purpose:string){
 if(!/^[A-Za-z0-9_-]{43}$/.test(raw))throw new TikkiesError('invalid_ticket',401)
 const hash=codeHash(raw)
 const rows=await db.$queryRaw<{user_id:string;offer:unknown}[]>`DELETE FROM tikkies_checkout_codes WHERE code_hash=${hash} AND challenge=${purpose} AND expires_at>clock_timestamp() RETURNING user_id,offer`
 if(rows.length!==1)throw new TikkiesError('invalid_ticket',401)
 return rows[0]
}
export async function startBrowserCheckout(db:Db,raw:string){
 const row=await consumeBrowserCode(db,raw,browserTicketPurpose),user=await browserBuyer(db,row.user_id),context=browserContext(row.offer),offer=await currentBrowserOffer(db,context.offer)
 const nonce=randomBytes(32).toString('base64url'),hash=codeHash(nonce)
 const payload=browserPayload({...context,offer}),contextHash=codeHash(JSON.stringify(payload))
 await db.$executeRaw`INSERT INTO tikkies_checkout_codes (code_hash,user_id,challenge,offer,expires_at) VALUES (${hash},${user.id}::uuid,${confirmationPurpose},${JSON.stringify(payload)}::jsonb,clock_timestamp()+interval '5 minutes')`
 // Keep large OAuth profiles in the one-use server record, not in a pending cookie.
 const token=await encode({secret:process.env.NEXTAUTH_SECRET!,salt:pendingSalt,maxAge:300,token:{provider:'tikkies-browser-pending',role:'user',id:user.id,nonce,offer,contextHash,pendingExpiresAt:Math.floor(Date.now()/1000)+300}})
 return {token,preview:{account:accountPreview(user,context),offer,nonce}}
}
export async function readBrowserPending(db:Db,token:string){
 let data;try{data=await decode({secret:process.env.NEXTAUTH_SECRET!,salt:pendingSalt,token})}catch{throw new TikkiesError('invalid_ticket',401)}
 if(!data||data.provider!=='tikkies-browser-pending'||typeof data.id!=='string'||typeof data.nonce!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(data.nonce)||!Number.isFinite(data.pendingExpiresAt)||Number(data.pendingExpiresAt)<=Math.floor(Date.now()/1000))throw new TikkiesError('invalid_ticket',401)
 const user=await browserBuyer(db,data.id),hash=codeHash(data.nonce)
 const rows=await db.$queryRaw<{user_id:string;offer:unknown}[]>`SELECT user_id,offer FROM tikkies_checkout_codes WHERE code_hash=${hash} AND challenge=${confirmationPurpose} AND expires_at>clock_timestamp()`
 if(rows.length!==1||rows[0].user_id!==user.id)throw new TikkiesError('invalid_ticket',401)
 const context=browserContext(rows[0].offer),payload=browserPayload(context),offer=await currentBrowserOffer(db,context.offer)
 if(JSON.stringify(checkoutQuote(data.offer))!==JSON.stringify(offer)||data.contextHash!==undefined&&data.contextHash!==codeHash(JSON.stringify(payload))||context.identity&&!data.contextHash)throw new TikkiesError('invalid_ticket',401)
 return {user,offer,context,nonce:data.nonce,preview:{account:accountPreview(user,context),offer,nonce:data.nonce}}
}
export async function confirmBrowserCheckout(db:Db,pendingToken:string,nonce:string,other=false){
 const pending=await readBrowserPending(db,pendingToken)
 if(nonce!==pending.nonce)throw new TikkiesError('forbidden',403)
 const row=await consumeBrowserCode(db,nonce,confirmationPurpose)
 if(row.user_id!==pending.user.id||JSON.stringify(browserPayload(browserContext(row.offer)))!==JSON.stringify(browserPayload(pending.context)))throw new TikkiesError('invalid_ticket',401)
 if(other)return null
 const user=pending.user
 const identity=pending.context.identity,now=Math.floor(Date.now()/1000)
 if(identity){
  const knownOwner=await resolveTikkiesCustomer(db,user.email,pending.context.identities??[{provider:identity.provider,providerAccountId:identity.providerAccountId}])
  if(knownOwner&&knownOwner.id!==user.id)throw new TikkiesError('identity_conflict',409)
  const owner=await checkIdentityOwner(db,user.id,identity)
  if(!owner)assertFreshMailbox(identity,user.email)
  // An atomic empty-update upsert never moves a provider from another customer.
  let linked:{user_id:string}|null
  try{linked=await db.accounts.upsert({where:accountKey(identity),create:{user_id:user.id,provider:identity.provider,provider_account_id:identity.providerAccountId},update:{},select:{user_id:true}})}
  catch(error){
   if(!error||typeof error!=='object'||!('code' in error)||error.code!=='P2002')throw error
   linked=await db.accounts.findUnique({where:accountKey(identity),select:{user_id:true}})
  }
  if(linked?.user_id!==user.id)throw new TikkiesError('identity_conflict',409)
  const token=await encode({secret:process.env.NEXTAUTH_SECRET!,maxAge:websiteSessionMaxAge,token:{id:user.id,sub:user.id,name:identity.name??user.email,email:user.email,picture:identity.image,role:user.role,provider:identity.provider,providerAccountId:identity.providerAccountId,roleLastFetched:now,checkoutOffer:pending.offer,checkoutOfferExpiresAt:now+nativeEntryOfferMaxAge}})
  return {token,maxAge:websiteSessionMaxAge}
 }
 const token=await encode({secret:process.env.NEXTAUTH_SECRET!,maxAge:900,token:{id:user.id,sub:user.id,name:user.username,email:user.email,picture:user.avatar,role:'user',provider:'tikkies-checkout',checkoutOffer:pending.offer,checkoutExpiresAt:now+900}})
 return {token,maxAge:900}
}
