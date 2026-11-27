import {NextRequest,NextResponse} from 'next/server'
import {prisma} from '@/lib/prisma'
import {authenticateTikkies,readTikkiesBody} from '@/lib/integrations/tikkiesSecurity'
import {TikkiesError} from '@/lib/integrations/tikkies'
import {issueBrowserCheckout,privateHeaders} from '@/lib/tikkiesBrowserCheckout'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export async function POST(req:NextRequest){
 try{
  authenticateTikkies(req)
  if(req.nextUrl.search)throw new TikkiesError('invalid_input',400)
  const body=await readTikkiesBody(req,8192) as Record<string,unknown>
  if(!body||Array.isArray(body)||Object.keys(body).some(k=>!['email','offer','locale','identity','identities'].includes(k))||typeof body.email!=='string'||body.email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)||body.locale!==undefined&&!['en','th'].includes(String(body.locale)))throw new TikkiesError('invalid_input',400)
  return NextResponse.json(await issueBrowserCheckout(prisma,body.email,body.offer,body.locale==='th'?'th':'en',body.identity,body.identities),{headers:privateHeaders})
 }catch(e){return NextResponse.json({error:e instanceof TikkiesError?e.code:'checkout_unavailable'},{status:e instanceof TikkiesError?e.status:503,headers:privateHeaders})}
}
