import { randomUUID } from 'node:crypto'
import { NextRequest,NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { TikkiesError } from '@/lib/integrations/tikkies'
import { authenticateTikkies,limitTikkiesSubject,readTikkiesBody } from '@/lib/integrations/tikkiesSecurity'
import { parseMembershipRequest,readTikkiesMembership,membershipIdentityHash } from '@/lib/integrations/tikkiesMembership'

export const runtime='nodejs'
export const dynamic='force-dynamic'
export async function POST(req:NextRequest){
  const headers:Record<string,string>={'Cache-Control':'no-store, private','X-Request-Id':randomUUID()}
  try{
    const credential=authenticateTikkies(req)
    if(req.nextUrl.search)throw new TikkiesError('invalid_input',400)
    const input=parseMembershipRequest(await readTikkiesBody(req,8192))
    const retry=await limitTikkiesSubject(prisma,'membership:'+(input.identities?membershipIdentityHash(input.identities):input.email),credential)
    if(retry){headers['Retry-After']=String(retry);throw new TikkiesError('rate_limited',429)}
    const result=await prisma.$transaction(tx=>readTikkiesMembership(tx,input.email,new Date(),input.identities),{isolationLevel:'RepeatableRead',timeout:10000})
    return NextResponse.json(result,{headers})
  }catch(error){return NextResponse.json({error:error instanceof TikkiesError?error.code:'membership_unavailable'},{status:error instanceof TikkiesError?error.status:503,headers})}
}
