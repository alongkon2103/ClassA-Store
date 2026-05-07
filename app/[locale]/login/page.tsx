import type { Metadata } from "next"
import { Link, redirect } from "@/i18n/routing"
import { getServerSession } from "next-auth"
// import { authOptions } from "@/lib/auth"
import LoginCard from "@/components/login/LoginCard"
import { setRequestLocale, getTranslations } from "next-intl/server"

export const metadata: Metadata = {
  title: "Login — Class A Store",
  description: "Sign in to Class A Store with Discord or Google",
}

interface LoginPageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ callbackUrl?: string }>
}

export default async function LoginPage({ params, searchParams }: LoginPageProps) {
  const { locale } = await params
  const { callbackUrl: callbackUrlRaw } = await searchParams
  setRequestLocale(locale)
  const t = await getTranslations("Login")
  
  // If already logged in, redirect immediately
//   const session = await getServerSession(authOptions)
//   if (session) redirect(searchParams.callbackUrl ?? "/")

  const callbackUrl = callbackUrlRaw ?? "/"

  return (
    <>
      {/* ── Global styles for this page ── */}
      <style>{`
        .login-card {
          background: var(--color-bg-card);
          border: 1px solid var(--color-border-soft);
          transition: border-color .3s;
        }
        .login-card:hover {
          border-color: var(--color-border-hover);
        }
        .btn-provider {
          box-shadow: 0 4px 24px rgba(88,101,242,0.25);
        }
        .btn-provider:hover {
          opacity: .9;
          transform: translateY(-2px);
          box-shadow: 0 8px 32px rgba(88,101,242,0.40);
        }
        .btn-provider:active { transform: translateY(0); }

        .btn-provider-outline:hover {
          background: rgba(255,255,255,0.09) !important;
          border-color: var(--color-border-hover) !important;
          transform: translateY(-1px);
        }
        .btn-provider-outline:active { transform: translateY(0); }

        .grid-bg {
          background-image:
            linear-gradient(rgba(66,122,181,.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(66,122,181,.05) 1px, transparent 1px);
          background-size: 48px 48px;
        }
        .orb {
          border-radius: 50%;
          filter: blur(110px);
          position: absolute;
          pointer-events: none;
        }

        @keyframes fadeUp {
          from { opacity:0; transform:translateY(20px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes scaleIn {
          from { opacity:0; transform:scale(.94); }
          to   { opacity:1; transform:scale(1); }
        }
        @keyframes pulse-ring {
          0%   { box-shadow: 0 0 0 0    rgba(88,101,242,.35); }
          70%  { box-shadow: 0 0 0 12px rgba(88,101,242,0); }
          100% { box-shadow: 0 0 0 0    rgba(88,101,242,0); }
        }

        .login-card   { animation: scaleIn .45s cubic-bezier(.22,1,.36,1) both; }
        .anim-icon    { animation: fadeUp .45s .10s ease both; }
        .anim-title   { animation: fadeUp .45s .18s ease both; }
        .anim-desc    { animation: fadeUp .45s .26s ease both; }
        .anim-btn     { animation: fadeUp .45s .34s ease both; }
        .anim-pills   { animation: fadeUp .45s .42s ease both; }
        .anim-footer  { animation: fadeUp .45s .50s ease both; }
        .pulse-ring   { animation: pulse-ring 2.4s ease-in-out infinite; }

        .back-link { color: var(--color-text-muted); transition: color .2s; }
        .back-link:hover { color: var(--color-text-base); }
      `}</style>

      {/* ── Minimal Nav ── */}
      <nav
        className="flex items-center justify-between px-6 md:px-10 py-4 border-b"
        style={{
          borderColor: "var(--color-border-soft)",
          background: "var(--color-bg-base)",
        }}
      >
        <a
          href="/"
          className="font-display text-[20px] font-bold tracking-wide no-underline"
          style={{ color: "var(--color-text-base)" }}
        >
          Class A{" "}
          <span style={{ color: "var(--color-accent-light)" }}>Store</span>
        </a>
        <Link href="/" className="back-link text-[13px] flex items-center gap-1.5 no-underline">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          {t("back_to_store")}
        </Link>
      </nav>

      {/* ── Main ── */}
      <main
        className="relative flex-1 flex items-center justify-center px-4 py-16 overflow-hidden"
        style={{ minHeight: "calc(100vh - 57px - 57px)" }}
      >
        {/* Background */}
        <div className="grid-bg absolute inset-0" />
        <div
          className="orb w-[500px] h-[500px]"
          style={{
            top: "50%", left: "50%",
            transform: "translate(-50%,-50%)",
            background:
              "radial-gradient(circle, rgba(88,101,242,.10) 0%, rgba(66,122,181,.06) 50%, transparent 70%)",
          }}
        />
        <div
          className="orb w-[220px] h-[220px]"
          style={{
            bottom: "-2.5rem", right: "-2.5rem",
            background: "rgba(66,122,181,.08)",
          }}
        />

        {/* Card */}
        <LoginCard callbackUrl={callbackUrl} />
      </main>

      {/* ── Footer ── */}
      <footer
        className="px-10 py-5 border-t flex items-center justify-between flex-wrap gap-3"
        style={{ borderColor: "var(--color-border-soft)" }}
      >
        <div
          className="font-display text-[15px] font-bold"
          style={{ color: "var(--color-text-muted)" }}
        >
          Class A{" "}
          <span style={{ color: "var(--color-accent-light)" }}>Store</span>
        </div>
        <p className="text-[12px]" style={{ color: "var(--color-text-muted)" }}>
          {t("footer_rights")}
        </p>
      </footer>
    </>
  )
}