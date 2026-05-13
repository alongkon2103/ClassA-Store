import { prisma } from "@/lib/prisma"
import BankSettingsClient from "./BankSettingsClient"
import GlobalSettingsClient from "./GlobalSettingsClient"
import { setRequestLocale } from "next-intl/server"

export default async function SettingsPage({
  params
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const banks = await prisma.bank_accounts.findMany({
    orderBy: { created_at: "desc" },
  })
  return (
    <div className="space-y-10 pb-20">
      <BankSettingsClient banks={banks} />
      <GlobalSettingsClient />
    </div>
  )
}