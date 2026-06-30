import { NextResponse } from "next/server"
import { getFeatureFlags } from "@/lib/featureFlags"

// Public feature-flag readout — Navbar uses it to decide whether to show the
// LiveGen tab without doing a server roundtrip per page. No secrets here, just
// boolean toggles the admin already controls in settings.

export const dynamic = "force-dynamic"

export async function GET() {
  const flags = await getFeatureFlags()
  return NextResponse.json(flags)
}
