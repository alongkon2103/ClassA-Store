// lib/auth.ts
import type { AuthOptions } from "next-auth"
import type { Role } from "@prisma/client"
import DiscordProvider from "next-auth/providers/discord"
import GoogleProvider from "next-auth/providers/google"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma"

export const authOptions: AuthOptions = {
    providers: [
        // ── DEV ONLY mock admin ──────────────────────────────────────
        ...(process.env.NODE_ENV === "development"
            ? [
                CredentialsProvider({
                    id: "dev-admin",
                    name: "Dev Admin",
                    credentials: {},
                    async authorize() {
                        return {
                            id: "e4ce8ce4-740c-42f3-9cf1-a1b16a30baba",
                            name: "Dev Admin",
                            email: "admin@dev.local",
                            image: null,
                            role: "admin",
                        }
                    },
                }),
            ]
            : []),
        // ────────────────────────────────────────────────────────────

        DiscordProvider({
            clientId: process.env.DISCORD_CLIENT_ID!,
            clientSecret: process.env.DISCORD_CLIENT_SECRET!,
            authorization: { params: { scope: "identify email" } },
        }),
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
    ],

    session: {
        strategy: "jwt",
        maxAge: 60 * 60 * 24 * 7, // 7 วัน
    },

    pages: {
        signIn: "/login",
        error: "/login",
    },

    callbacks: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async signIn({ user, account }: any) {
            if (!account) return false

            try {
                const email = user.email ?? null

                let dbUser = email
                    ? await prisma.users.findFirst({ where: { email } })
                    : null

                if (!dbUser) {
                    dbUser = await prisma.users.create({
                        data: {
                            id: account.provider === "dev-admin" ? user.id : undefined,
                            username: user.name ?? "Unknown",
                            email,
                            avatar: user.image ?? null,
                            role: (account.provider === "dev-admin" ? "admin" : "user") as Role,
                        },
                    })
                } else {
                    await prisma.users.update({
                        where: { id: dbUser.id },
                        data: { 
                            avatar: user.image ?? undefined,
                            role: account.provider === "dev-admin" ? "admin" : dbUser.role
                        },
                    })
                }

                if (account.provider !== "dev-admin") {
                    await prisma.accounts.upsert({
                        where: {
                            provider_provider_account_id: {
                                provider: account.provider,
                                provider_account_id: account.providerAccountId,
                            },
                        },
                        create: {
                            user_id: dbUser.id,
                            provider: account.provider,
                            provider_account_id: account.providerAccountId,
                            access_token: account.access_token ?? null,
                            refresh_token: account.refresh_token ?? null,
                            expires_at: account.expires_at ?? null,
                            token_type: account.token_type ?? null,
                            scope: account.scope ?? null,
                            id_token: account.id_token ?? null,
                        },
                        update: {
                            access_token: account.access_token ?? null,
                            refresh_token: account.refresh_token ?? null,
                            expires_at: account.expires_at ?? null,
                        },
                    })
                }

                // Apply a pre-authorized desktop whitelist grant for this email
                // (buyer was whitelisted before their first login). One-shot:
                // move the plan onto the user, then drop the pending row.
                if (email) {
                    const grant = await prisma.desktop_whitelist_grants.findUnique({ where: { email } })
                    if (grant) {
                        await prisma.users.update({
                            where: { id: dbUser.id },
                            data: { nativeExpiry: grant.expires_at },
                        })
                        await prisma.desktop_whitelist_grants.delete({ where: { email } }).catch(() => {})
                    }
                }

                user.id = dbUser.id
                return true

            } catch (err) {
                console.error("[auth] signIn error:", err)
                return false
            }
        },

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async jwt({ token, user, account }: any) {
            // ── ตอน sign in ครั้งแรก: เซต id และ provider ──
            if (user) {
                token.id = user.id
            }

            if (account) {
                token.provider = account.provider
                token.providerAccountId = account.providerAccountId
            }

            // ── dev mock: ไม่ต้อง query DB ──
            if (token.provider === "dev-admin") {
                token.role = "admin"
                return token
            }

            // ── ดึง role จาก DB ทุก 5 นาที ──
            if (token.id) {
                const now = Math.floor(Date.now() / 1000)
                const lastFetched = (token.roleLastFetched as number) ?? 0

                if (now - lastFetched > 60 * 5) {
                    const dbUser = await prisma.users.findUnique({
                        where: { id: token.id as string },
                        select: { role: true },
                    })
                    token.role = dbUser?.role ?? "user"
                    token.roleLastFetched = now
                }
            }

            return token
        },

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async session({ session, token }: any) {
            session.user.id = token.id
            session.user.role = token.role
            session.user.provider = token.provider
            session.user.providerAccountId = token.providerAccountId
            return session
        },
    },

    secret: process.env.NEXTAUTH_SECRET,
}