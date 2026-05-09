import { NextResponse } from "next/server"
declare global {
  var giftQueue: any[] | undefined
}

const giftQueue = (global.giftQueue ??= [])

export async function GET() {
  const gift = giftQueue.shift() || null

  return NextResponse.json(
    {
      ok: true,
      gift,
      remaining: giftQueue.length,
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Cache-Control": "no-store",
      },
    }
  )
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  })
}