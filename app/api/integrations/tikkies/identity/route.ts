import {NextRequest,NextResponse} from 'next/server'
import {prisma} from '@/lib/prisma'
import {authenticateTikkies,readTikkiesBody} from '@/lib/integrations/tikkiesSecurity'
import {TikkiesError} from '@/lib/integrations/tikkies'
import {ensureNativeStoreCustomer,privateHeaders} from '@/lib/tikkiesBrowserCheckout'
import {claimNativeEmailWhitelist} from '@/lib/nativeEmailWhitelist'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export async function POST(req:NextRequest){
 try{
  authenticateTikkies(req)
  if(req.nextUrl.search)throw new TikkiesError('invalid_input',400)
  const body=await readTikkiesBody(req,8192) as Record<string,unknown>
  if(!body||Array.isArray(body)||Object.keys(body).some(k=>!['identity','identities'].includes(k)))throw new TikkiesError('invalid_input',400)
  let customerId:string
  for(let attempt=0;;attempt++){
   try{
    const customer=await prisma.$transaction(tx=>ensureNativeStoreCustomer(tx,body.identity,body.identities),{isolationLevel:'Serializable'})
    customerId=customer.id
    break
   }catch(error){
    const code=error&&typeof error==='object'&&'code' in error?error.code:null
    if(attempt>=2||!['P2002','P2034'].includes(String(code)))throw error
   }
  }
  await prisma.$transaction(tx=>claimNativeEmailWhitelist(tx,customerId,body.identity,body.identities),{isolationLevel:'ReadCommitted'})
  return NextResponse.json({ok:true},{headers:privateHeaders})
 }catch(e){return NextResponse.json({error:e instanceof TikkiesError?e.code:'identity_unavailable'},{status:e instanceof TikkiesError?e.status:503,headers:privateHeaders})}
}
