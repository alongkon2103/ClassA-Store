import {NextRequest,NextResponse} from 'next/server'
import {encode} from 'next-auth/jwt'
import {setWebsiteSessionCookie} from '@/lib/websiteSessionCookie'
import {prisma} from '@/lib/prisma'
import {consumeCheckoutCode,checkoutForm} from '@/lib/tikkiesCheckoutLogin'

export const dynamic='force-dynamic'
export async function POST(req:NextRequest){
 const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}
 try{
  const site=new URL(process.env.NEXTAUTH_URL||req.url)
  if(req.headers.get('origin')!==site.origin||req.headers.get('sec-fetch-site')==='cross-site')return NextResponse.json({error:'forbidden'},{status:403,headers})
  if(!process.env.NEXTAUTH_SECRET || process.env.NODE_ENV==='production'&&site.protocol!=='https:')throw Error('configuration')
  if(Number(req.headers.get('content-length'))>4096)return NextResponse.json({error:'invalid_request'},{status:400,headers})
  const form=await checkoutForm(req),code=form.get('code'),verifier=form.get('verifier')
  const approval=await consumeCheckoutCode(prisma,typeof code==='string'?code:'',typeof verifier==='string'?verifier:'')
  if(!approval)return NextResponse.json({error:'invalid_code'},{status:401,headers})
  const user=await prisma.users.findUnique({where:{id:approval.userId},select:{id:true,username:true,email:true,avatar:true,role:true,nativeStatus:true}})
  if(!user||user.nativeStatus==='KICKED')return NextResponse.json({error:'account_not_allowed'},{status:403,headers})
  const token=await encode({secret:process.env.NEXTAUTH_SECRET,maxAge:900,token:{id:user.id,sub:user.id,name:user.username,email:user.email,picture:user.avatar,role:'user',provider:'tikkies-checkout',checkoutOffer:approval.offer,checkoutExpiresAt:Math.floor(Date.now()/1000)+900}})
  const prefix=form.get('locale')==='th'?'/th':'/en'
  const response=NextResponse.redirect(new URL(prefix+'/bundles/checkout',site),{status:303,headers})
  if(site.protocol==='https:')setWebsiteSessionCookie(req,response,token,900)
  else response.cookies.set('next-auth.session-token',token,{httpOnly:true,secure:false,sameSite:'lax',path:'/',maxAge:900})
  return response
 }catch(error){return NextResponse.json({error:error instanceof Error&&error.message==='invalid_request'?'invalid_request':'checkout_login_unavailable'},{status:error instanceof Error&&error.message==='invalid_request'?400:503,headers})}
}
