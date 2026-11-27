import { NextResponse } from "next/server"
import { BundleError, freezeBundle, type BundleProductInput, type BundleVariantInput } from "./bundles"
import type { Prisma } from "@prisma/client"

/** Called before creating a payment session; the client never supplies the contents. */
export async function prepareBundleCheckout(
  db: Pick<Prisma.TransactionClient, "products">,
  product: BundleProductInput,
  variant: BundleVariantInput | null | undefined,
  input: { username: unknown; premium?: unknown; buyerRole?: string },
) {
  if (product.type !== "bundle") return undefined
  if (!input.buyerRole || !["user","admin","partnership","affiliate"].includes(input.buyerRole)) throw new BundleError("bundle_account_not_allowed", 403)
  if (input.premium) throw new BundleError("bundle_premium_not_supported")
  const snapshot = await freezeBundle(db, product, variant)
  if ((snapshot.allAcGames || snapshot.items.some(item => item.type === "roblox_whitelist")) &&
    (typeof input.username !== "string" || !/^[A-Za-z0-9_]{3,20}$/.test(input.username.trim()))) {
    throw new BundleError("bundle_roblox_username_required")
  }
  return snapshot
}

export function bundleCheckoutError(error: unknown) {
  return error instanceof BundleError
    ? NextResponse.json({ error: error.code, errorCode: error.code }, { status: error.status })
    : null
}
