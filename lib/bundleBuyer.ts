import {BundleError} from './bundles'
import type {Prisma} from '@prisma/client'
import {checkoutQuote} from './tikkiesCheckoutQuote'

/** Recheck the database before contacting a payment provider; cached OAuth roles are insufficient. */
export async function currentBundleBuyerRole(db:Pick<Prisma.TransactionClient,'users'>,user:{id?:string;role?:string;provider?:string}) {
 if(!user.id)throw new BundleError('bundle_account_not_allowed',403)
 const buyer=await db.users.findUnique({where:{id:user.id},select:{role:true,nativeStatus:true}})
 if(!buyer||!['user','admin','partnership','affiliate'].includes(buyer.role)||buyer.nativeStatus==='KICKED')throw new BundleError('bundle_account_not_allowed',403)
 return buyer.role
}

export function assertBundleQuote(user:{provider?:string;checkoutOffer?:unknown},productId:string,variantId:string,days:number|null,price:number,productType='bundle') {
 if(user.provider!=='tikkies-checkout')return
 let q;try{q=checkoutQuote(user.checkoutOffer)}catch{throw new BundleError('bundle_offer_changed',409)}
 if(productType!=='bundle'||q.code!==`bundle:${productId}:${variantId}`||q.days!==days||Math.round(q.priceTHB*100)!==Math.round(price*100))throw new BundleError('bundle_offer_changed',409)
}
