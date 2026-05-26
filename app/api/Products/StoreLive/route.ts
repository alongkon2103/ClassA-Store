// app/api/Products/StoreLive/route.ts

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
 * OPTIONS /api/Products/StoreLive
 * Required for CORS preflight
 */
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * GET /api/Products/StoreLive
 * 🛡️ Protected by x-internal-key header
 */
export async function GET(request: NextRequest) {
  try {
    // ── Security Check ─────────────────────────────────────────────
    const internalKey = request.headers.get("x-internal-key");
    const secret = process.env.INTERNAL_API_KEY;

    if (!internalKey || internalKey !== secret) {
      console.warn("[SECURITY] Unauthorized attempt to access StoreLive API");

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

    // ── Fetch Products ────────────────────────────────────────────
    const products = await prisma.products.findMany({
      where: {
        is_active: true,
      },

      orderBy: {
        created_at: "desc",
      },

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
        discord_role_id: true,
        discord_guild_id: true,
        created_at: true,
        updated_at: true,

        // ── Default settings ──────────────────────────────────────
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

        // ── Variants ──────────────────────────────────────────────
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

        // ── Images ────────────────────────────────────────────────
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

        // ── Presets ───────────────────────────────────────────────
        product_presets: {
          orderBy: {
            sort_order: "asc",
          },

          select: {
            id: true,
            url: true,
            filename: true,
            filesize: true,
            sort_order: true,
          },
        },

        // ── Gifts ─────────────────────────────────────────────────
        product_gifts: {
          orderBy: {
            sort_order: "asc",
          },

          select: {
            id: true,
            url: true,
            filename: true,
            sort_order: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: products,
      },
      {
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error("[GET /api/Products/StoreLive]", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch products",
      },
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}