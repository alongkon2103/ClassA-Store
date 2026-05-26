// app/api/gifts/sync/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createGiftIfNotExists } from '@/lib/gifts'

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────
  const apiKey = req.headers.get('x-api-key')
  if (!apiKey || apiKey !== process.env.INTERNAL_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { giftId, giftName, diamond } = await req.json()

    if (!giftId || !giftName) {
      return NextResponse.json(
        { error: 'giftId and giftName are required' },
        { status: 400 }
      )
    }

    const { gift, created } = await createGiftIfNotExists(
      Number(giftId),
      giftName,
      diamond ?? 0
    )

    return NextResponse.json({ success: true, gift, created })

  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Gift name already exists', detail: error.meta },
        { status: 409 }
      )
    }

    console.error('[gift-sync] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}