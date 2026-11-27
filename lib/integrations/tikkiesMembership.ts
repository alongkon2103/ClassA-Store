import {resolveTikkiesCustomer} from './tikkiesCustomer'
import type { Prisma } from '@prisma/client'
import {createHash} from 'node:crypto'
import { bundleTermExpiry, parseBundleSnapshot } from '../bundles'
import { TikkiesError,parseIdentities,type Identity } from './tikkies'

const PERMANENT = Date.parse('9999-12-31T00:00:00Z')
export function parseMembershipRequest(body: unknown): {email: string;identities?:Identity[]} {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new TikkiesError('invalid_input',400)
  const input=body as Record<string,unknown>
  if (Object.keys(input).some(key=>!['email','identities'].includes(key)) || typeof input.email!=='string' || input.email.length>254 || /[\x00-\x1f\x7f]/.test(input.email) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) throw new TikkiesError('invalid_input',400)
  return {email:input.email.trim().toLowerCase(),...(input.identities===undefined?{}:{identities:parseIdentities({identities:input.identities})})}
}
export function membershipIdentityHash(identities:Identity[]){
 const owned=parseIdentities({identities}).sort((a,b)=>`${a.provider}:${a.providerAccountId}`<`${b.provider}:${b.providerAccountId}`?-1:`${a.provider}:${a.providerAccountId}`>`${b.provider}:${b.providerAccountId}`?1:0)
 return createHash('sha256').update(JSON.stringify(owned)).digest('hex')
}

/** Read purchased, frozen membership rights. Never infer full-app access from game ownership. */
export async function readTikkiesMembership(db: Prisma.TransactionClient, value: string, now: Date, identityValues?:Identity[]) {
  const {email,identities}=parseMembershipRequest({email:value,...(identityValues===undefined?{}:{identities:identityValues})})
  const denied={email,allowed:false,expiresAt:null as string|null,...(identities?{identityHash:membershipIdentityHash(identities)}:{})}
  const customer=await resolveTikkiesCustomer(db,email,identities)
  if(!customer || customer.nativeStatus==='KICKED')return denied
  const orders=await db.orders.findMany({where:{user_id:customer.id,order_type:'BUNDLE',bundle_parent_id:null,status:'paid',paid_at:{not:null},fulfilled_at:{not:null},expires_at:{gt:now},whitelist_status:'whitelisted'},take:1001,
    select:{status:true,order_type:true,bundle_parent_id:true,paid_at:true,fulfilled_at:true,expires_at:true,whitelist_status:true,bundle_snapshot:true}})
  if(orders.length>1000)throw new TikkiesError('entitlement_capacity_exceeded',503)
  let expires=0
  for(const order of orders){
    if(order.status!=='paid' || order.order_type!=='BUNDLE' || order.bundle_parent_id || order.whitelist_status!=='whitelisted' || !order.paid_at || !order.fulfilled_at || !order.expires_at)continue
    const paid=order.paid_at.getTime(), fulfilled=order.fulfilled_at.getTime(), recorded=order.expires_at.getTime()
    if(!Number.isFinite(paid) || !Number.isFinite(fulfilled) || !Number.isFinite(recorded) || paid>now.getTime() || fulfilled>now.getTime())continue
    try{
      const terms=parseBundleSnapshot(order.bundle_snapshot)
      if(terms.tikkiesMembership!==true)continue
      const purchased=bundleTermExpiry(terms,order.fulfilled_at).getTime()
      const end=Math.min(recorded,purchased,PERMANENT)
      if(Number.isFinite(end) && end>now.getTime())expires=Math.max(expires,end)
    }catch{ /* Corrupt or legacy terms cannot manufacture a full-app grant. */ }
  }
  return expires?{...denied,allowed:true,expiresAt:new Date(expires).toISOString()}:denied
}
