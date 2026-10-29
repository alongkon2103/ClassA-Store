import type { Metadata } from "next"
import HalloweenDrawPreview from "@/components/seasonal/HalloweenDrawPreview"
import { getHalloweenState } from "@/lib/halloweenDraw"

export const dynamic = "force-dynamic"

export const metadata: Metadata = { title: "ฟักทองแจกโชค · UI Preview | A Class Store", robots: { index: false, follow: false } }

export default async function HalloweenPreviewPage() {
  const { games } = await getHalloweenState(null)
  return <HalloweenDrawPreview demoGames={games} />
}
