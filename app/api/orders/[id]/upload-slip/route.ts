import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import sharp from "sharp"
import jsQR from "jsqr"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const order = await prisma.orders.findUnique({
    where: { id },
    include: { product_variants: true, products: true },
  })

  if (!order)
    return NextResponse.json({ error: "Order not found" }, { status: 404 })

  if (order.user_id !== session.user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  if (order.status !== "pending")
    return NextResponse.json({ error: "Order already processed" }, { status: 400 })

  // Check if we should increment discount_used
  const shouldIncrementDiscount = !!(
    order.variant_id && 
    order.products.has_limited_discount && 
    order.product_variants &&
    Number(order.product_variants.discount_pct) > 0 &&
    (order.product_variants.discount_used ?? 0) < (order.product_variants.discount_limit ?? 0)
  )

  // ─────────────────────────────
  // 1. Receive file
  const formData = await req.formData()
  const file = formData.get("slip") as File

  if (!file)
    return NextResponse.json({ error: "No slip uploaded" }, { status: 400 })

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  // ─────────────────────────────
  // 2. Save image
  const ext = file.name.split(".").pop()
  const filename = `slip-${id}-${Date.now()}.${ext}`
  const uploadDir = path.join(process.cwd(), "public", "slips")

  await mkdir(uploadDir, { recursive: true })
  await writeFile(path.join(uploadDir, filename), buffer)

  const slipUrl = `/slips/${filename}`

  // ─────────────────────────────
  // 3. Decode QR from image
  let qrCode = null;

  // First attempt: raw image
  const image = sharp(buffer)
  const { data, info } = await image
    .raw()
    .ensureAlpha()
    .toBuffer({ resolveWithObject: true })

  qrCode = jsQR(
    new Uint8ClampedArray(data),
    info.width,
    info.height
  )

  // Second attempt: grayscale and high contrast if first fails
  if (!qrCode) {

    const processedImage = await sharp(buffer)
      .greyscale()
      .linear(1.5, -0.2) // Increase contrast
      .raw()
      .ensureAlpha()
      .toBuffer({ resolveWithObject: true })

    qrCode = jsQR(
      new Uint8ClampedArray(processedImage.data),
      processedImage.info.width,
      processedImage.info.height
    )
  }

  if (!qrCode) {
    return NextResponse.json(
      { error: "QR Code not found in slip. Please ensure the QR is clear and try again." },
      { status: 400 }
    )
  }

  const qrData = qrCode.data

 
  const easySlipRes = await fetch(
    "https://api.easyslip.com/v2/verify/bank",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.EASY_SLIP_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        payload: qrData,
      }),
    }
  )

  const slipData = await easySlipRes.json()
  console.log(slipData)
  if (!easySlipRes.ok || slipData.status !== 200) {
    await prisma.orders.update({
      where: { id },
      data: {
        slip_image_url: slipUrl,
        slip_verified: false,
      },
    })

    return NextResponse.json(
      {
        error: "Invalid slip or verification failed",
        detail: slipData,
      },
      { status: 400 }
    )
  }

  // ─────────────────────────────
  // 5. Check amount
  const paidAmount = slipData.data?.amount?.amount
  const orderAmount = Number(order.amount)

  if (paidAmount < orderAmount) {
    return NextResponse.json(
      {
        error: `Invalid amount (Paid ฿${paidAmount} but requires ฿${orderAmount})`,
      },
      { status: 400 }
    )
  }

  // ─────────────────────────────
  // 6. Prevent duplicate slips
  const transRef = slipData.data?.transRef

  if (transRef) {
    const dup = await prisma.orders.findUnique({
      where: { trans_ref: transRef },
    })

    if (dup)
      return NextResponse.json(
        { error: "This slip has already been used" },
        { status: 400 }
      )
  }

  // ─────────────────────────────
  // 7. Assign key
  const key = await prisma.game_keys.findFirst({
    where: {
      variant_id: order.variant_id!,
      status: "available",
    },
  })

  if (!key)
    return NextResponse.json(
      { error: "Out of stock. Please contact admin." },
      { status: 400 }
    )

  // ─────────────────────────────
  // 8. Transaction update
  await prisma.$transaction([
    prisma.orders.update({
      where: { id },
      data: {
        status: "paid",
        paid_at: new Date(),
        fulfilled_at: new Date(),
        slip_image_url: slipUrl,
        slip_verified: true,
        trans_ref: transRef ?? null,
        updated_at: new Date(),
      },
    }),

    prisma.game_keys.update({
      where: { id: key.id },
      data: {
        status: "assigned",
        order_id: id,
        assigned_at: new Date(),
      },
    }),

    // 3. Increment discount quota if applicable
    ...(shouldIncrementDiscount ? [
      prisma.product_variants.update({
        where: { id: order.variant_id! },
        data: { discount_used: { increment: 1 } }
      })
    ] : [])
  ])

  return NextResponse.json({ ok: true, orderId: id })
}