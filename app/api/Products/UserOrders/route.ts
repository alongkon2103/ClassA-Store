// app/api/Products/UserOrders/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ─────────────────────────────────────────────────────────────
// CORS Headers
// ─────────────────────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, x-internal-key",
};

/**
 * OPTIONS /api/Products/UserOrders
 * Required for CORS preflight
 */
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * POST /api/Products/UserOrders
 * Body:
 * {
 *   "userId": "uuid"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // ── Security Check ─────────────────────────────────────────────
    const internalKey = request.headers.get("x-internal-key");
    const secret = process.env.INTERNAL_API_KEY;

    if (!internalKey || internalKey !== secret) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized access",
        },
        {
          status: 401,
          headers: corsHeaders,
        }
      );
    }

    // ── Parse Body ────────────────────────────────────────────────
    const body = await request.json();
    const userId = body?.userId;

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing userId",
        },
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    // ── Find User Orders ──────────────────────────────────────────
    const orders = await prisma.orders.findMany({
      where: {
        user_id: userId,
        status: "paid",
      },

      orderBy: {
        created_at: "desc",
      },

      select: {
        id: true,
        amount: true,
        status: true,
        created_at: true,
        paid_at: true,
        expires_at: true,
        whitelisted_username: true,
        tiktok_username: true,
        is_premium_order: true,

        // ── Product ───────────────────────────────────────────────
        products: {
          select: {
            id: true,
            slug: true,
            name_th: true,
            name_en: true,
            description_th: true,
            description_en: true,
            price: true,
            is_active: true,
            is_featured: true,
            info_page_url: true,
            youtube_url: true,
            tutorial_video_url: true,

            // ── Default Functions ─────────────────────────────────
            product_functions: {
              orderBy: {
                sort_order: "asc",
              },

              select: {
                id: true,
                name: true,
                label_th: true,
                label_en: true,
                image_url: true,
                sort_order: true,
                default_trigger_threshold: true,

                default_gift: {
                  select: {
                    id: true,
                    name: true,
                    image_url: true,
                    diamonds: true,
                    trigger_type: true,
                  },
                },
              },
            },

            // ── Variants ──────────────────────────────────────────
            product_variants: {
              where: {
                is_active: true,
              },

              orderBy: {
                sort_order: "asc",
              },

              select: {
                id: true,
                label_th: true,
                label_en: true,
                duration_type: true,
                duration_days: true,
                price: true,
                variant_type: true,
                premium_addon_price: true,
              },
            },

            // ── Images ────────────────────────────────────────────
            product_images: {
              orderBy: {
                sort_order: "asc",
              },

              select: {
                id: true,
                url: true,
                alt_text: true,
                sort_order: true,
              },
            },
          },
        },

        // ── Selected Variant ──────────────────────────────────────
        product_variants: {
          select: {
            id: true,
            label_th: true,
            label_en: true,
            duration_type: true,
            duration_days: true,
            price: true,
            variant_type: true,
          },
        },

        // ── User Custom Functions ─────────────────────────────────
        user_function_gifts: {
          select: {
            id: true,
            trigger_threshold: true,

            gifts: {
              select: {
                id: true,
                name: true,
                image_url: true,
                diamonds: true,
                trigger_type: true,
              },
            },

            product_functions: {
              select: {
                id: true,
                name: true,
                label_th: true,
                label_en: true,
                image_url: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        total: orders.length,
        data: orders,
      },
      {
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error("[POST /api/Products/UserOrders]", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch user orders",
      },
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}