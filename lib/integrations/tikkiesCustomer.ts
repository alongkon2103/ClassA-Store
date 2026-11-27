import type {Prisma} from '@prisma/client'
import {parseIdentities,TikkiesError,type Identity} from './tikkies'
type Db=Pick<Prisma.TransactionClient,'accounts'|'users'|'$queryRaw'>
/** Every native entitlement uses the same durable store owner. Email-only RPCs remain legacy compatible. */
export async function resolveTikkiesCustomer(db:Db,email:string|null,identityValues?:Identity[]){
 if(identityValues!==undefined){
  const identities=parseIdentities({identities:identityValues})
  const accounts=await db.accounts.findMany({where:{OR:identities.map(i=>({provider:i.provider,provider_account_id:i.providerAccountId}))},select:{user_id:true}})
  const owners=[...new Set(accounts.map(a=>a.user_id))]
  if(owners.length>1)throw new TikkiesError('identity_conflict',409)
  return owners.length?db.users.findUnique({where:{id:owners[0]},select:{id:true,email:true,nativeStatus:true,hwid:true}}):null
 }
 if(!email)return null
 const rows=await db.$queryRaw<{id:string;email:string|null;nativeStatus:string|null;hwid:string|null}[]>`SELECT id,email,"nativeStatus",hwid FROM users WHERE lower(btrim(email))=${email.trim().toLowerCase()} LIMIT 2`
 if(rows.length>1)throw new TikkiesError('identity_conflict',409)
 return rows[0]??null
}
