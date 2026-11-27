import {NextRequest,NextResponse} from 'next/server'
import {prisma} from '@/lib/prisma'
import {readTikkiesBody} from '@/lib/integrations/tikkiesSecurity'
import {TikkiesError} from '@/lib/integrations/tikkies'
import {requireCheckoutOrigin,startBrowserCheckout,readBrowserPending,pendingCookie,privateHeaders} from '@/lib/tikkiesBrowserCheckout'
export const dynamic='force-dynamic'
function failure(e:unknown){return NextResponse.json({error:e instanceof TikkiesError?e.code:'checkout_unavailable'},{status:e instanceof TikkiesError?e.status:503,headers:privateHeaders})}
export async function POST(req:NextRequest){
 try{
  requireCheckoutOrigin(req)
  const body=await readTikkiesBody(req,4096) as Record<string,unknown>
  if(!body||Object.keys(body).some(k=>k!=='ticket')||typeof body.ticket!=='string'||body.ticket.length>43)throw new TikkiesError('invalid_input',400)
  const result=await startBrowserCheckout(prisma,body.ticket)
  const response=NextResponse.json(result.preview,{headers:privateHeaders})
  response.cookies.set(pendingCookie,result.token,{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:300})
  return response
 }catch(e){return failure(e)}
}
export async function GET(req:NextRequest){
 try{return NextResponse.json((await readBrowserPending(prisma,req.cookies.get(pendingCookie)?.value||'')).preview,{headers:privateHeaders})}catch(e){return failure(e)}
}
