// lib/auth.ts
import type { AuthOptions, Session } from "next-auth"
import type { JWT } from "next-auth/jwt"
import DiscordProvider from "next-auth/providers/discord"
import GoogleProvider from "next-auth/providers/google"
import { prisma } from "@/lib/prisma"

export const authOptions: AuthOptions = {
    providers: [
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
        // ── 1. signIn: upsert user + account ─────────────────────────
        async signIn({ user, account, profile }: any) {
            if (!account) return false

            try {
                const email = user.email ?? null

                // หา user จาก email ก่อน (merge Discord + Google ที่ email ตรงกัน)
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

                // upsert account record ของ provider นี้
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

                // แปะ DB id กลับไปให้ jwt callback ใช้
                user.id = dbUser.id
                return true

            } catch (err) {
                console.error("[auth] signIn error:", err)
                return false
            }
        },

        // ── 2. jwt: เก็บ id + role ลง token (ทำครั้งเดียวตอน login) ──
        async jwt({ token, user, account }: any) {
            if (user) {
                token.id = user.id

                const dbUser = await prisma.users.findUnique({
                    where: { id: user.id },
                    select: { role: true },
                })
                token.role = dbUser?.role ?? "user"
            }
            // เก็บ provider ทุกครั้งที่ login ใหม่
            if (account) {
                token.provider = account.provider  // "discord" | "google"
            }
            return token
        },

        async session({ session, token }: any) {
            session.user.id = token.id
            session.user.role = token.role
            session.user.provider = token.provider  // ส่งออกมาที่ session
            return session
        },
    },

    secret: process.env.NEXTAUTH_SECRET,
}