import { prisma } from "@/lib/prisma"
import BankSettingsClient from "./BankSettingsClient"
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
  return <BankSettingsClient banks={banks} />
}