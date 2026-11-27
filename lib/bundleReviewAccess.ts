import { cache } from 'react'
import { getServerSession } from 'next-auth'
import { notFound, redirect } from 'next/navigation'
import { authOptions } from './auth'
import {currentBundleBuyerRole} from './bundleBuyer'
import {prisma} from './prisma'

const sessionForRequest = cache(() => getServerSession(authOptions))
export async function requireBundleReviewAdmin(locale:string,returnPath='/bundles-preview') {
  if (!['en','th','ja','zh','ko','vi'].includes(locale)) notFound()
  const session = await sessionForRequest()
  const prefix = locale === 'en' ? '' : '/' + locale
  if (!session?.user) redirect(prefix + '/login?callbackUrl=' + encodeURIComponent(prefix + returnPath))
  if(session.user.provider==='tikkies-checkout') {
    if(returnPath!=='/bundles/checkout')notFound()
    try{await currentBundleBuyerRole(prisma,session.user)}catch{notFound()}
  } else if (session.user.role !== 'admin') notFound()
  return session
}

export async function requireBundleBuyerSession(locale:string) {
 if(!['en','th','ja','zh','ko','vi'].includes(locale))notFound()
 const session=await sessionForRequest(),prefix=locale==='en'?'/en':'/'+locale
 if(!session?.user)redirect(prefix+'/login?callbackUrl='+encodeURIComponent(prefix+'/bundles/checkout'))
 try{await currentBundleBuyerRole(prisma,session.user)}catch{notFound()}
 return session
}
