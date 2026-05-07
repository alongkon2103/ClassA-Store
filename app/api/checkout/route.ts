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

        const { productId, variantId, locale = "en" } = await req.json()

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

        // 🔍 Check if there is an existing pending order
        let order = await prisma.orders.findFirst({
            where: {
                user_id: session.user.id,
                product_id: product.id,
                variant_id: variant?.id || null,
                status: "pending",
            }
        })

        // If not, create a new one
        if (!order) {
            order = await prisma.orders.create({
                data: {
                    user_id: session.user.id,
                    product_id: product.id,
                    variant_id: variant?.id,
                    amount: finalPrice,
                    status: "pending",
                }
            })
        }

        // 🔥 Prevent baseUrl from being empty and ensure it is an absolute URL
        const protocol = req.headers.get("x-forwarded-proto") || "http"
        const host = req.headers.get("host")
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`

        const stripeSession = await stripe.checkout.sessions.create({
            mode: "payment",
            payment_method_types: ["card", "promptpay"],
            expires_at: Math.floor(Date.now() / 1000) + (30 * 60), // 30 mins from now

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

            success_url: `${baseUrl}/${locale}/orders/${order.id}`,
            cancel_url: `${baseUrl}/${locale}/products`,

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