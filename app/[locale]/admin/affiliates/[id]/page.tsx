// Full-page affiliate analytics (admin). Access is gated by the admin layout.
import { setRequestLocale } from "next-intl/server"
import AffiliateAnalyticsClient from "./AffiliateAnalyticsClient"

export default async function Page({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params
  setRequestLocale(locale)
  return <AffiliateAnalyticsClient id={id} />
}
