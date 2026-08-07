// app/[locale]/desktop/login/page.tsx
//
// The brokered desktop sign-in page. The Electron app opens this in the system
// browser with ?state&port&challenge. We reuse the EXISTING NextAuth login:
//   - no web session  → bounce to /login, returning here afterwards
//   - session present → show a consent card that mints a one-time code and
//     redirects to the app's loopback URL (via /api/desktop/authorize)

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "@/i18n/routing"
import DesktopLoginClient from "./DesktopLoginClient"

export const dynamic = "force-dynamic"

function first(v: string | string[] | undefined): string {
  return Array.isArray(v) ? v[0] ?? "" : v ?? ""
}

export default async function DesktopLoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { locale } = await params
  const sp = await searchParams
  const state = first(sp.state)
  const port = first(sp.port)
  const challenge = first(sp.challenge)

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    // Return to this exact page (with its params) after the normal login.
    // `redirect` throws, so nothing below runs when unauthenticated.
    const qs = new URLSearchParams({ state, port, challenge }).toString()
    redirect({ href: `/login?callbackUrl=${encodeURIComponent(`/desktop/login?${qs}`)}`, locale })
  }
  const account = session!.user

  const paramsOk = /^\d{2,5}$/.test(port) && /^[A-Za-z0-9_-]{43}$/.test(challenge) && state.length > 0 && state.length <= 256

  return (
    <DesktopLoginClient
      ok={paramsOk}
      state={state}
      port={port}
      challenge={challenge}
      account={{ name: account.name ?? null, email: account.email ?? null, image: account.image ?? null }}
    />
  )
}
