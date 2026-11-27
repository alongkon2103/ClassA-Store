import {NextRequest,NextResponse} from 'next/server'
import {getServerSession} from 'next-auth'
import {authOptions} from '@/lib/auth'
import {prisma} from '@/lib/prisma'
import {checkoutLoginInput,matchesAccount,createCheckoutCode,checkoutForm} from '@/lib/tikkiesCheckoutLogin'

export const dynamic='force-dynamic'
export async function POST(req:NextRequest){
 const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}
 try{
  const origin=new URL(process.env.NEXTAUTH_URL||req.url).origin
  if(req.headers.get('origin')!==origin)return NextResponse.json({error:'forbidden'},{status:403,headers})
  if(Number(req.headers.get('content-length'))>4096)return NextResponse.json({error:'invalid_request'},{status:400,headers})
  const search=await checkoutForm(req)
  const input=checkoutLoginInput(search),session=await getServerSession(authOptions)
  if(!session?.user||session.user.provider==='tikkies-checkout'||!matchesAccount(session.user.email,input.account))return NextResponse.json({error:'account_not_allowed'},{status:403,headers})
  const user=await prisma.users.findUnique({where:{id:session.user.id},select:{nativeStatus:true,email:true,role:true}})
  if(!user||user.nativeStatus==='KICKED'||!matchesAccount(user.email,input.account))return NextResponse.json({error:'account_not_allowed'},{status:403,headers})
  const code=await createCheckoutCode(prisma,session.user.id,input.challenge,JSON.parse(input.offer))
  const callback=new URL(input.callback);callback.searchParams.set('code',code);callback.searchParams.set('state',input.state)
  return NextResponse.redirect(callback, {status:303,headers})
 }catch(error){return NextResponse.json({error:error instanceof Error&&error.message==='invalid_request'?'invalid_request':'checkout_login_unavailable'},{status:error instanceof Error&&error.message==='invalid_request'?400:503,headers})}
}
