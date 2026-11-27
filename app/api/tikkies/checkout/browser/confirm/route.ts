import {NextRequest,NextResponse} from 'next/server'
import {prisma} from '@/lib/prisma'
import {TikkiesError} from '@/lib/integrations/tikkies'
import {checkoutForm} from '@/lib/tikkiesCheckoutLogin'
import {requireCheckoutOrigin,confirmBrowserCheckout,checkoutSite,pendingCookie,privateHeaders} from '@/lib/tikkiesBrowserCheckout'
import {setWebsiteSessionCookie} from '@/lib/websiteSessionCookie'
export const dynamic='force-dynamic'
export async function POST(req:NextRequest){
 let prefix='/en'
 try{
  requireCheckoutOrigin(req)
  const form=await checkoutForm(req);prefix=form.get('locale')==='th'?'/th':'/en'
  const choice=form.get('choice'),nonce=form.get('nonce')||''
  if(!['continue','other'].includes(choice||''))throw new TikkiesError('invalid_input',400)
  const session=await confirmBrowserCheckout(prisma,req.cookies.get(pendingCookie)?.value||'',nonce,choice==='other')
  const target=choice==='other'?prefix+'/login?callbackUrl='+encodeURIComponent(prefix+'/bundles'):prefix+'/bundles/checkout'
  const response=NextResponse.redirect(new URL(target,checkoutSite()),{status:303,headers:privateHeaders})
  response.cookies.set(pendingCookie,'',{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:0})
  if(session)setWebsiteSessionCookie(req,response,session.token,session.maxAge)
  return response
 }catch(e){
  if(e instanceof TikkiesError&&e.code==='forbidden')return NextResponse.json({error:'forbidden'},{status:403,headers:privateHeaders})
  const reason=e instanceof TikkiesError&&['offer_changed','identity_conflict','identity_verification_required'].includes(e.code)?e.code:'expired'
  return NextResponse.redirect(new URL(prefix+'/bundles/confirm?'+reason+'=1',checkoutSite()),{status:303,headers:privateHeaders})
 }
}
