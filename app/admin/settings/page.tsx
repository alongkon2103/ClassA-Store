import { prisma } from "@/lib/prisma"
import BankSettingsClient from "./BankSettingsClient"

export default async function SettingsPage() {
  const banks = await prisma.bank_accounts.findMany({
    orderBy: { created_at: "desc" },
  })
  return <BankSettingsClient banks={banks} />
}