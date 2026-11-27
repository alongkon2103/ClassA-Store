import { requireAdminPage } from "@/lib/adminAuth"
import { prisma } from "@/lib/prisma"
import SettingsWorkspace from "./SettingsWorkspace"
import { setRequestLocale } from "next-intl/server"

export default async function SettingsPage({
    params
}: {
    params: Promise<{ locale: string }>
}) {
    await requireAdminPage()
    const { locale } = await params
    setRequestLocale(locale)

    const configs = await prisma.system_configs.findMany()
    const configMap = Object.fromEntries(configs.map(c => [c.key, c.value]))

    return (
        <SettingsWorkspace initialConfigs={configMap} />
    )
}
