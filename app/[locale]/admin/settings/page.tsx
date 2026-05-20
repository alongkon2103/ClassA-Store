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

    const configs = await prisma.system_configs.findMany()
    const configMap = Object.fromEntries(configs.map(c => [c.key, c.value]))

    return (
        <div className="space-y-10 pb-20">
            <GlobalSettingsClient initialConfigs={configMap} />
        </div>
    )
}