/** USD per THB, shared by catalog/checkout display. Never changes a payment quote. */
export function validUsdRate(rate:unknown):rate is number{return typeof rate==='number'&&Number.isFinite(rate)&&rate>0&&rate<1}
export function formatDisplayMoney(thb:number,locale:string,rate?:number|null){
 if(locale!=='th'&&validUsdRate(rate))return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(thb*rate)
 return locale==='th'?new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB'}).format(thb):`THB ${thb.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`
}
