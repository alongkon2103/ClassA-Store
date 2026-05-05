import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Stripe from "stripe"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { productId, variantId } = await req.json()

        const product = await prisma.products.findUnique({
            where: { id: productId },
            include: {
                product_variants: true,
            },
        })

        if (!product) {
            return NextResponse.json({ error: "Product not found" }, { status: 404 })
        }

        const variant = product.product_variants.find(v => v.id === variantId)

        const finalPrice = variant
            ? Number(variant.price)
            : Number(product.price)

        const title = variant
            ? `${product.name_en} (${variant.label_en})`
            : product.name_en

        const order = await prisma.orders.create({
            data: {
                user_id: session.user.id,
                product_id: product.id,
                variant_id: variant?.id,
                amount: finalPrice,
                status: "pending",
            }
        })

        // 🔥 ป้องกัน baseUrl ว่าง และต้องเป็น absolute URL
        const protocol = req.headers.get("x-forwarded-proto") || "http"
        const host = req.headers.get("host")
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`

        const stripeSession = await stripe.checkout.sessions.create({
            mode: "payment",
            payment_method_types: ["card"],

            line_items: [
                {
                    price_data: {
                        currency: "thb",
                        product_data: {
                            name: title,
                        },
                        unit_amount: Math.round(finalPrice * 100),
                    },
                    quantity: 1,
                },
            ],

            success_url: `${baseUrl}/orders/${order.id}`,
            cancel_url: `${baseUrl}/products`,

            metadata: {
                orderId: order.id,
                productId: product.id,     
                variantId: variant?.id || "",
            },
        })

        await prisma.orders.update({
            where: { id: order.id },
            data: {
                stripe_session_id: stripeSession.id,
            },
        })

        return NextResponse.json({ url: stripeSession.url })
    } catch (err) {
        console.error(err)
        return NextResponse.json({ error: "Checkout failed" }, { status: 500 })
    }
}