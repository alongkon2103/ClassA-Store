// app/api/affiliate/api-key/route.ts
//
// POST → the affiliate (re)generates their OWN public-API key. Returns the
// plaintext key ONCE; only its hash is stored. Requires admin to have enabled
// API access (affiliate_profiles.api_enabled) — otherwise 403.

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { generateApiKey } from "@/lib/affiliateApi"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = session.user.id

  const profile = await prisma.affiliate_profiles.findUnique({
    where: { user_id: userId },
    select: { api_enabled: true },
  })
  if (!profile) return NextResponse.json({ error: "Not an affiliate" }, { status: 403 })
  if (!profile.api_enabled) {
    return NextResponse.json({ error: "API_DISABLED", errorCode: "API_DISABLED" }, { status: 403 })
  }

  const { key, hash, prefix } = generateApiKey()
  await prisma.affiliate_profiles.update({
    where: { user_id: userId },
    data: { api_key_hash: hash, api_key_prefix: prefix, api_key_created_at: new Date() },
  })

  // Plaintext returned ONCE — the affiliate must copy it now.
  return NextResponse.json({ key, prefix })
}
