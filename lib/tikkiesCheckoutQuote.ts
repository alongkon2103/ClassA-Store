/** The offer explicitly selected in Tikkies, carried only by a signed checkout session. */
export type CheckoutQuote = {code:string; priceTHB:number; days:number|null}
export function checkoutQuote(value:unknown):CheckoutQuote {
 const q=value as Partial<CheckoutQuote>|null
 if(!q||typeof q.code!=='string'||!/^bundle:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/.test(q.code)||!Number.isFinite(q.priceTHB)||Number(q.priceTHB)<=0||!(q.days===null||Number.isSafeInteger(q.days)&&Number(q.days)>0))throw Error('invalid_request')
 return {code:q.code,priceTHB:Number(q.priceTHB),days:q.days!}
}
