type Order = {id:string;product_id:string;stripe_session_id:string|null;amount:unknown;payment_method:string|null}
type StripePayment = {id:string;mode?:string|null;payment_status?:string;currency?:string|null;amount_total?:number|null;metadata?:{[key:string]:string}|null}

/** Signed provider events must still match this order's frozen checkout total. */
export function matchesBundleStripePayment(order:Order,payment:StripePayment):boolean {
  const amount=Number(order.amount)
  return !!order.stripe_session_id && order.stripe_session_id===payment.id &&
    ['card','promptpay'].includes(order.payment_method??'') && payment.mode==='payment' && payment.payment_status==='paid' &&
    payment.currency==='thb' && Number.isFinite(amount) && amount>0 && Number.isSafeInteger(payment.amount_total) &&
    payment.amount_total===Math.round(amount*100) && payment.metadata?.orderId===order.id && payment.metadata?.productId===order.product_id
}
