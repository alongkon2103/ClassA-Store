// app/api/gifts/sync/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createGiftIfNotExists } from '@/lib/gifts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
}

// รองรับ preflight (สำคัญมาก)
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key')
  if (!apiKey || apiKey !== process.env.INTERNAL_API_KEY) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: corsHeaders }
    )
  }

  try {
    const { giftId, giftName, diamond } = await req.json()

    if (!giftId || !giftName) {
      return NextResponse.json(
        { error: 'giftId and giftName are required' },
        { status: 400, headers: corsHeaders }
      )
    }

    const { gift, created } = await createGiftIfNotExists(
      Number(giftId),
      giftName,
      diamond ?? 0
    )

    return NextResponse.json(
      { success: true, gift, created },
      { headers: corsHeaders }
    )

  } catch (error: unknown) {
    const err = error as { code?: string; meta?: unknown }
    if (err.code === 'P2002') {
      return NextResponse.json(
        { error: 'Gift name already exists', detail: err.meta },
        { status: 409, headers: corsHeaders }
      )
    }

    console.error('[gift-sync] error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    )
  }
}