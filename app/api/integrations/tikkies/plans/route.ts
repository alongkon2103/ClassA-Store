import {NextRequest,NextResponse} from 'next/server'
import {prisma} from '@/lib/prisma'
import {authenticateTikkies} from '@/lib/integrations/tikkiesSecurity'
import {TikkiesError} from '@/lib/integrations/tikkies'
import {getThbToUsdRate} from '@/lib/paypal'
import {tikkiesBundlePlans} from '@/lib/tikkiesBundlePlans'

export const runtime='nodejs'
export const dynamic='force-dynamic'
export async function GET(req:NextRequest){
 const headers={'Cache-Control':'no-store, private'}
 try{
  authenticateTikkies(req)
  if(req.nextUrl.search)throw new TikkiesError('invalid_input',400)
  const products=await prisma.products.findMany({
   where:{is_active:true,OR:[{type:'bundle',slug:'ac-games-membership'},{type:{in:['roblox_whitelist','desktop_program']}}],AND:[{OR:[{is_consignment:false},{is_consignment:null}]}]},
   include:{product_images:{orderBy:{sort_order:'asc'}},product_variants:{where:{is_active:true},orderBy:{sort_order:'asc'}}},
   orderBy:[{display_order:'asc'},{created_at:'desc'}],take:502,
  })
  if(products.length>501)throw new TikkiesError('catalog_capacity_exceeded',503)
  const usdRate=await getThbToUsdRate()
  return NextResponse.json({plans:tikkiesBundlePlans(products).map(plan=>({...plan,usdRate}))},{headers})
 }catch(error){return NextResponse.json({error:error instanceof TikkiesError?error.code:'bundle_catalog_unavailable'},{status:error instanceof TikkiesError?error.status:503,headers})}
}
