import type {Prisma} from '@prisma/client'
import {browserIdentity,assertFreshMailbox} from './tikkiesBrowserIdentity'
import {TikkiesError} from './integrations/tikkies'
import {claimEmailWhitelistOrders,whitelistEmailLockKey} from './manualWhitelistEmail'
import {parseIdentities} from './integrations/tikkies'
import {resolveTikkiesCustomer} from './integrations/tikkiesCustomer'
import {browserBuyer} from './tikkiesBrowserCheckout'

/** Run after canonical customer linking commits, in a separate READ COMMITTED transaction. */
export async function claimNativeEmailWhitelist(db:Prisma.TransactionClient,customerId:string,identityValue:unknown,identityValues:unknown):Promise<number>{
 const identity=browserIdentity(identityValue),email=identity.verifiedEmail??null
 try{assertFreshMailbox(identity,email)}catch(error){
  if(error instanceof TikkiesError&&error.code==='identity_verification_required')return 0
  throw error
 }
 // Every statement gets a fresh post-lock snapshot, including an admin grant
 // committed while this request was waiting. SERIALIZABLE cannot supply that.
 await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${whitelistEmailLockKey(email!)}, 0))`
 const customer=await resolveTikkiesCustomer(db,null,parseIdentities({identities:identityValues}))
 if(!customer||customer.id!==customerId)throw new TikkiesError('identity_conflict',409)
 const buyer=await browserBuyer(db,customer.id)
 return claimEmailWhitelistOrders(db,buyer.id,email!)
}
