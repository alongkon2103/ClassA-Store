// Dev helper: add / remove TEST affiliate commission so you can try the
// withdrawal flow end-to-end (affiliate requests → admin pays/rejects).
//
//   npx tsx --env-file=.env scripts/seed-affiliate-test.ts add [amount] [email]
//   npx tsx --env-file=.env scripts/seed-affiliate-test.ts clean [email]
//
// Test data is tagged buyer_label="__AFF_TEST__" so `clean` removes exactly
// what it created (test orders + their earnings + any open test request).
// Safe to delete this file when you're done testing.

import { prisma } from "@/lib/prisma"

const TAG = "__AFF_TEST__"

async function main() {
  const mode = process.argv[2] ?? "add"
  const amount = Number(process.argv[3]) || 500
  const email = process.argv[4] // optional; defaults to the first affiliate

  const profile = email
    ? await prisma.affiliate_profiles.findFirst({ where: { user: { email } }, include: { user: true } })
    : await prisma.affiliate_profiles.findFirst({ orderBy: { created_at: "asc" }, include: { user: true } })
  if (!profile) {
    console.log("No affiliate found. Create one in /admin/affiliates first.")
    return
  }
  const uid = profile.user_id
  console.log(`Affiliate: ${profile.user.username} <${profile.user.email}>`)

  if (mode === "request") {
    // Simulate the affiliate clicking "ขอถอนเงิน": move pending → requested and
    // create the request row, so the cancel button (affiliate) and the reject/
    // pay buttons (admin) appear.
    const pending = await prisma.affiliate_earnings.findMany({ where: { affiliate_user_id: uid, status: "pending" }, select: { id: true, commission_amount: true } })
    const total = Math.round(pending.reduce((s, e) => s + Number(e.commission_amount), 0) * 100) / 100
    if (pending.length === 0) { console.log("No pending balance to request."); return }
    const open = await prisma.affiliate_payouts.count({ where: { affiliate_user_id: uid, status: "requested" } })
    if (open > 0) { console.log("There's already an open request."); return }
    const req = await prisma.affiliate_payouts.create({
      data: { affiliate_user_id: uid, amount: total, status: "requested", method: profile.payout_method, detail: profile.payout_detail, requested_at: new Date() },
    })
    await prisma.affiliate_earnings.updateMany({ where: { id: { in: pending.map((e) => e.id) } }, data: { status: "requested", payout_id: req.id } })
    console.log(`Created a withdrawal request for ฿${total}.`)
    console.log("→ /affiliate: ค้างจ่าย = ฿0, รอโอน = ฿" + total + ", + ปุ่ม 'ยกเลิกคำขอ'")
    console.log("→ /admin/affiliates: การ์ด 'คำขอถอนเงิน (1)' + ปุ่ม จ่ายแล้ว / ปฏิเสธ")
    return
  }

  if (mode === "clean") {
    const testOrders = await prisma.orders.findMany({ where: { buyer_label: TAG }, select: { id: true } })
    const ids = testOrders.map((o) => o.id)
    await prisma.affiliate_earnings.deleteMany({ where: { order_id: { in: ids } } })
    await prisma.orders.deleteMany({ where: { id: { in: ids } } })
    // Remove any leftover open/resolved test requests that now cover nothing.
    const orphans = await prisma.affiliate_payouts.findMany({
      where: { affiliate_user_id: uid, status: { in: ["requested", "cancelled", "rejected"] } },
      select: { id: true, _count: { select: { earnings: true } } },
    })
    const orphanIds = orphans.filter((p) => p._count.earnings === 0).map((p) => p.id)
    await prisma.affiliate_payouts.deleteMany({ where: { id: { in: orphanIds } } })
    console.log(`Cleaned: ${ids.length} test order(s), ${orphanIds.length} empty test request(s).`)
    return
  }

  // add
  const product = await prisma.products.findFirst({ where: { is_active: true }, select: { id: true, name_en: true } })
  if (!product) { console.log("No active product."); return }

  const order = await prisma.orders.create({
    data: {
      product_id: product.id,
      amount: Math.round(amount / 0.2 * 1.06 * 100) / 100, // rough gross so commission ≈ amount at 20%
      status: "paid",
      payment_method: "card",
      order_type: "NEW",
      whitelist_status: "whitelisted",
      buyer_label: TAG,
      paid_at: new Date(),
    },
  })
  await prisma.affiliate_earnings.create({
    data: {
      affiliate_user_id: uid,
      order_id: order.id,
      base_amount: Math.round(amount / 0.2 * 100) / 100,
      commission_pct: Number(profile.default_commission_pct) || 20,
      commission_amount: amount,
      status: "pending",
    },
  })

  const pending = await prisma.affiliate_earnings.aggregate({ where: { affiliate_user_id: uid, status: "pending" }, _sum: { commission_amount: true } })
  console.log(`Added ฿${amount} test commission. Pending balance now: ฿${Number(pending._sum.commission_amount ?? 0)}`)
  console.log("→ Go to /affiliate and click ขอถอนเงิน (make sure the min-withdraw ≤ this amount).")
  console.log("→ Cleanup later:  npx tsx --env-file=.env scripts/seed-affiliate-test.ts clean")
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
