// lib/auth.ts
import type { AuthOptions, Session } from "next-auth"
import type { JWT } from "next-auth/jwt"
import DiscordProvider from "next-auth/providers/discord"
import GoogleProvider from "next-auth/providers/google"
import CredentialsProvider from "next-auth/providers/credentials" // เพิ่ม
import { prisma } from "@/lib/prisma"

export const authOptions: AuthOptions = {
    providers: [
        // ── DEV ONLY mock admin ──────────────────────────────────────
        // ...(process.env.NODE_ENV === "development"
        //     ? [
        //         CredentialsProvider({
        //             id: "dev-admin",
        //             name: "Dev Admin",
        //             credentials: {},
        //             async authorize() {
        //                 return {
        //                     id: "e4ce8ce4-740c-42f3-9cf1-a1b16a30baba", // ← UUID จริงๆ
        //                     name: "Dev Admin",
        //                     email: "admin@dev.local",
        //                     image: null,
        //                     role: "admin",
        //                 }
        //             },
        //         }),
        //     ]
        //     : []),
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

    session: { strategy: "jwt" },

    pages: {
        signIn: "/login",
        error: "/login",
    },

    callbacks: {
        async signIn({ user, account, profile }: any) {
            // ── skip DB upsert for dev mock ──
            if (account?.provider === "dev-admin") return true

            if (!account) return false

            try {
                const email = user.email ?? null

                let dbUser = email
                    ? await prisma.users.findFirst({ where: { email } })
                    : null

                if (!dbUser) {
                    dbUser = await prisma.users.create({
                        data: {
                            username: user.name ?? "Unknown",
                            email,
                            avatar: user.image ?? null,
                            role: "user",
                        },
                    })
                } else {
                    await prisma.users.update({
                        where: { id: dbUser.id },
                        data: { avatar: user.image ?? undefined },
                    })
                }

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

                user.id = dbUser.id
                return true

            } catch (err) {
                console.error("[auth] signIn error:", err)
                return false
            }
        },

        async jwt({ token, user, account }: any) {
            if (user) {
                token.id = user.id

                // ── dev mock: skip DB lookup, inject role directly ──
                if (account?.provider === "dev-admin") {
                    token.role = "admin"
                } else {
                    const dbUser = await prisma.users.findUnique({
                        where: { id: user.id },
                        select: { role: true },
                    })
                    token.role = dbUser?.role ?? "user"
                }
            }

            if (account) {
                token.provider = account.provider
                token.providerAccountId = account.providerAccountId
            }
            return token
        },

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