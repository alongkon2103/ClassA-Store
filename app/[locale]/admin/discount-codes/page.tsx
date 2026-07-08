// app/[locale]/admin/discount-codes/page.tsx

import DiscountCodeManager from "./DiscountCodeManager"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export default async function DiscountCodesAdminPage() {
  const [codes, products] = await Promise.all([
    prisma.discount_codes.findMany({
      orderBy: { created_at: "desc" },
      include: {
        product: { select: { id: true, name_en: true, name_th: true } },
        _count: { select: { redemptions: true } },
      },
    }),
    prisma.products.findMany({
      where: { is_active: true },
      select: { id: true, name_en: true, name_th: true },
      orderBy: { name_en: "asc" },
    }),
  ])

  return (
    <div>
      <DiscountCodeManager
        initialCodes={codes.map((c) => ({
          id: c.id,
          code: c.code,
          type: c.type,
          value: Number(c.value),
          max_uses: c.max_uses,
          used_count: c.used_count,
          per_user_limit: c.per_user_limit,
          min_amount: c.min_amount ? Number(c.min_amount) : null,
          product_id: c.product_id,
          product_name: c.product?.name_en ?? null,
          starts_at: c.starts_at?.toISOString() ?? null,
          expires_at: c.expires_at?.toISOString() ?? null,
          is_active: c.is_active,
          is_public: c.is_public,
          note: c.note,
          redemption_count: c._count.redemptions,
        }))}
        products={products.map((p) => ({ id: p.id, name: p.name_en }))}
      />
    </div>
  )
}
