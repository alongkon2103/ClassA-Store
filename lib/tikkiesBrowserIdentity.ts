import {parseIdentities,type Identity} from './integrations/tikkies'
import {TikkiesError} from './integrations/tikkies'
import {checkoutQuote,type CheckoutQuote} from './tikkiesCheckoutQuote'

export type BrowserIdentity={provider:'google'|'discord';providerAccountId:string;name:string|null;image:string|null;verifiedEmail?:string;verifiedAt?:number}
export type BrowserContext={offer:CheckoutQuote;identity?:BrowserIdentity;identities?:Identity[]}
export function browserIdentity(value:unknown):BrowserIdentity {
 const data=value as Record<string,unknown>|null
 if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).some(key=>!['provider','providerAccountId','name','image','verifiedEmail','verifiedAt'].includes(key)))throw new TikkiesError('invalid_input',400)
 if(!['google','discord'].includes(String(data.provider))||typeof data.providerAccountId!=='string'||!/^[A-Za-z0-9._:-]{1,255}$/.test(data.providerAccountId))throw new TikkiesError('invalid_input',400)
 if(data.name!=null&&(typeof data.name!=='string'||data.name.length>200||/[\x00-\x1f\x7f]/.test(data.name)))throw new TikkiesError('invalid_input',400)
 if(data.image!=null){
  if(typeof data.image!=='string'||data.image.length>2048||/[\x00-\x20\x7f]/.test(data.image))throw new TikkiesError('invalid_input',400)
  try{const url=new URL(data.image);if(url.protocol!=='https:'||url.username||url.password)throw Error()}catch{throw new TikkiesError('invalid_input',400)}
 }
 let proof:Pick<BrowserIdentity,'verifiedEmail'|'verifiedAt'>={}
 if(data.verifiedEmail!==undefined||data.verifiedAt!==undefined){
  if(typeof data.verifiedEmail!=='string'||data.verifiedEmail.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.verifiedEmail)||typeof data.verifiedAt!=='number'||!Number.isSafeInteger(data.verifiedAt)||data.verifiedAt<=0)throw new TikkiesError('invalid_input',400)
  proof={verifiedEmail:data.verifiedEmail.trim().toLowerCase(),verifiedAt:data.verifiedAt}
 }
 return {provider:data.provider as BrowserIdentity['provider'],providerAccountId:data.providerAccountId,name:typeof data.name==='string'?data.name.trim()||null:null,image:typeof data.image==='string'?data.image:null,...proof}
}
/** A historical native mailbox alone cannot authorize a new website provider binding. */
export function assertFreshMailbox(identity:BrowserIdentity,email:string|null,now=Math.floor(Date.now()/1000)){
 if(!email||identity.verifiedEmail!==email.trim().toLowerCase()||!identity.verifiedAt||identity.verifiedAt>now+30||identity.verifiedAt<now-900)throw new TikkiesError('identity_verification_required',403)
}
export function browserContext(value:unknown):BrowserContext {
 const data=value as Record<string,unknown>|null
 if(data?.schemaVersion===2)return {offer:checkoutQuote(data.offer),identity:browserIdentity(data.identity),...(data.identities===undefined?{}:{identities:parseIdentities({identities:data.identities})})}
 return {offer:checkoutQuote(value)} // Old checkout-only grants retain their original scope.
}
export function browserPayload(context:BrowserContext){return context.identity?{schemaVersion:2,offer:context.offer,identity:context.identity,...(context.identities?{identities:context.identities}:{})}:context.offer}
