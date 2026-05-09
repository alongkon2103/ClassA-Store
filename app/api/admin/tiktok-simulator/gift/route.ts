import { NextRequest, NextResponse } from "next/server"

declare global {
  var giftQueue: any[] | undefined
}

const giftQueue = (global.giftQueue ??= [])

export async function POST(req: NextRequest) {
  const event = await req.json()

  giftQueue.push(event)

  return NextResponse.json({
    ok: true,
    queueSize: giftQueue.length,
  })
}