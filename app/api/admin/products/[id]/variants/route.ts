import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  
  // ดึงฟิลด์ใหม่เพิ่ม: variant_type และ premium_addon_price
  const { 
    label_en, 
    label_th, 
    duration_type, 
    duration_days, 
    price, 
    sort_order, 
    is_active,
    variant_type,
    premium_addon_price,
    discount_pct,
    discount_limit 
  } = body

  if (!label_en || !label_th || price === undefined) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  if (duration_type === "days" && (!duration_days || Number(duration_days) <= 0)) {
    return NextResponse.json({ error: "Invalid duration days" }, { status: 400 })
  }

  try {
    const variant = await prisma.product_variants.create({
      data: {
        product_id:    id,
        label_en,
        label_th,
        duration_type: duration_type ?? "permanent",
        duration_days: duration_type === "days" ? Number(duration_days) : null,
        price:         Number(price),
        sort_order:    sort_order ?? 0,
        is_active:     is_active  ?? true,
        variant_type:  variant_type ?? "normal",
        premium_addon_price: premium_addon_price ? Number(premium_addon_price) : 0,
        discount_pct:   discount_pct ? Number(discount_pct) : 0,
        discount_limit: discount_limit ? Number(discount_limit) : 0,
        discount_used:  0,
      },
    })

    return NextResponse.json({ 
      ...variant, 
      price: Number(variant.price),
      premium_addon_price: Number(variant.premium_addon_price) 
    }, { status: 201 })
    
  } catch (error) {
    console.error("Error creating variant:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}