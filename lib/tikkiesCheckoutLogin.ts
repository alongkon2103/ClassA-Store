import {createHash,randomBytes,timingSafeEqual} from 'node:crypto'
import {checkoutQuote,type CheckoutQuote} from './tikkiesCheckoutQuote'
export const codeHash=(value:string)=>createHash('sha256').update(value).digest('hex')
export const accountHash=(value:string)=>codeHash(value.trim().toLowerCase())
export async function checkoutForm(req:Request){
 if(req.headers.get('content-type')?.split(';')[0].trim()!=='application/x-www-form-urlencoded')throw Error('invalid_request')
 const reader=req.body?.getReader();if(!reader)throw Error('invalid_request')
 const chunks:Uint8Array[]=[];let size=0
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096)throw Error('invalid_request');chunks.push(value)}}finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
 const search=new URLSearchParams(Buffer.concat(chunks).toString('utf8'))
 if(new Set(search.keys()).size!==[...search.keys()].length)throw Error('invalid_request')
 return search
}
export function checkoutLoginInput(search:URLSearchParams){
 const state=search.get('state')||'',challenge=search.get('challenge')||'',account=search.get('account')||'',callback=search.get('callback')||''
 const locale=search.get('locale')==='th'?'th':'en'
 let url:URL;try{url=new URL(callback)}catch{throw Error('invalid_request')}
 if(!/^[A-Za-z0-9_-]{43}$/.test(state)||!/^[A-Za-z0-9_-]{43}$/.test(challenge)||!/^[a-f0-9]{64}$/.test(account)||url.origin!==`http://127.0.0.1:${url.port}`||Number(url.port)<1024||url.pathname!=='/tikkies-checkout'||url.search||url.hash||url.username||url.password)throw Error('invalid_request')
 let offer:CheckoutQuote;try{offer=checkoutQuote(JSON.parse(search.get('offer')||'null'))}catch{throw Error('invalid_request')}
 return {state,challenge,account,callback:url.href,locale,offer:JSON.stringify(offer)}
}
export function matchesAccount(email:string|null|undefined,hash:string){return !!email&&timingSafeEqual(Buffer.from(accountHash(email)),Buffer.from(hash))}
type CodesDb={ $executeRaw:any;$queryRaw:any }
export async function createCheckoutCode(db:CodesDb,userId:string,challenge:string,offer:CheckoutQuote){
 const code=randomBytes(32).toString('base64url'),hash=codeHash(code)
 await db.$executeRaw`INSERT INTO tikkies_checkout_codes (code_hash,user_id,challenge,offer,expires_at) VALUES (${hash},${userId}::uuid,${challenge},${JSON.stringify(checkoutQuote(offer))}::jsonb,clock_timestamp()+interval '90 seconds')`
 await db.$executeRaw`DELETE FROM tikkies_checkout_codes WHERE code_hash IN (SELECT code_hash FROM tikkies_checkout_codes WHERE expires_at < clock_timestamp() LIMIT 100)`
 return code
}
export async function consumeCheckoutCode(db:CodesDb,code:string,verifier:string){
 if(!/^[A-Za-z0-9_-]{43}$/.test(code)||!/^[A-Za-z0-9_-]{43}$/.test(verifier))return null
 const hash=codeHash(code),challenge=createHash('sha256').update(verifier).digest('base64url')
 const rows=await db.$queryRaw`DELETE FROM tikkies_checkout_codes WHERE code_hash=${hash} AND challenge=${challenge} AND expires_at>clock_timestamp() RETURNING user_id,offer`
 const row=(rows as {user_id:string;offer:unknown}[])[0]
 return row?{userId:row.user_id,offer:checkoutQuote(row.offer)}:null
}
