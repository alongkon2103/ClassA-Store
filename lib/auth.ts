// lib/auth.ts
import type { AuthOptions } from "next-auth"
import type { Role } from "@prisma/client"
import DiscordProvider from "next-auth/providers/discord"
import GoogleProvider from "next-auth/providers/google"
import {websiteSessionMaxAge} from './authSession'
import CredentialsProvider from "next-auth/providers/credentials"
import {encode as encodeJwt,decode as decodeJwt} from 'next-auth/jwt'
import { prisma } from "@/lib/prisma"
import { findAccountUserId, findExistingUserId } from "@/lib/authIdentity"
import { normalizeEmail, verifiedProviderEmail } from "@/lib/verifiedEmail"
import { claimEmailWhitelistOrders } from "@/lib/manualWhitelistEmail"

function reportAuthFailure(context: string, error: unknown) {
    const code = (error as { code?: unknown })?.code
    console.error(`[auth] ${context}`, { code: typeof code === "string" && /^P\d{4}$/.test(code) ? code : "unknown" })
}

export const authOptions: AuthOptions = {
    jwt: {
        async encode(params) {
            if(params.token?.provider==='tikkies-checkout') {
                const remaining=Number(params.token.checkoutExpiresAt)-Math.floor(Date.now()/1000)
                if(!Number.isFinite(remaining)||remaining<=0)return ''
                return encodeJwt({...params,maxAge:Math.min(params.maxAge||900,remaining)})
            }
            return encodeJwt(params)
        },
        async decode(params) {
            const token=await decodeJwt(params)
            return token?.provider==='tikkies-checkout'&&(!Number.isFinite(token.checkoutExpiresAt)||Number(token.checkoutExpiresAt)<=Math.floor(Date.now()/1000))?null:token
        },
    },
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
            issuer: "https://discord.com",
            authorization: { params: { scope: "identify email" } },
        }),
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
    ],

    session: {
        strategy: "jwt",
        maxAge: websiteSessionMaxAge,
    },

    pages: {
        signIn: "/login",
        error: "/login",
    },

    callbacks: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async signIn({ user, account, profile }: any) {
            if (!account) return false

            try {
                const verifiedEmail = verifiedProviderEmail(account.provider, profile)
                const email = account.provider === "dev-admin" ? normalizeEmail(user.email) : verifiedEmail === normalizeEmail(user.email) ? verifiedEmail : null

                // หา user เดิมจากบัญชี provider ที่ผูกไว้ก่อน แล้วค่อยจากอีเมล (ดู lib/authIdentity.ts)
                // — หาจากอีเมลอย่างเดียวไม่ได้: Discord บางบัญชีไม่ส่งอีเมลมา → เคยสร้าง user ใหม่ทุกครั้งที่ล็อกอิน
                const existingId = account.provider === "dev-admin"
                    ? null
                    : await findExistingUserId(prisma, account.provider, account.providerAccountId, email)
                let dbUser = existingId
                    ? await prisma.users.findUnique({ where: { id: existingId } })
                    : email
                        ? await prisma.users.findFirst({ where: { email } }) // dev-admin
                        : null

                let updateProfile=!!dbUser
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
                }

                if (account.provider !== "dev-admin") {
                    const linked=await prisma.accounts.upsert({
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
                        select: { user_id: true },
                    })
                    // An SSO/OAuth callback may bind this subject after our initial lookup.
                    if(linked.user_id!==dbUser.id){
                        dbUser=await prisma.users.findUnique({where:{id:linked.user_id}})
                        if(!dbUser)return false
                        updateProfile=true
                    }
                }
                if(updateProfile){
                    await prisma.users.update({where:{id:dbUser.id},data:{avatar:user.image??undefined,role:account.provider==='dev-admin'?'admin':dbUser.role}})
                }

                // A verified mailbox can claim pre-authorized rights. These
                // independent operations must not make provider login fail.
                if (email && account.provider !== "dev-admin") {
                    try {
                        await claimEmailWhitelistOrders(prisma, dbUser.id, email)
                    } catch (error) {
                        // An optional entitlement operation must not reject a
                        // successfully authenticated provider account.
                        reportAuthFailure("email whitelist claim failed", error)
                    }
                    try {
                        const grants = await prisma.desktop_whitelist_grants.findMany({ where: { email } })
                        for (const grant of grants) {
                            await prisma.user_program_access.upsert({
                                where: { user_id_product_id: { user_id: dbUser.id, product_id: grant.product_id } },
                                create: { user_id: dbUser.id, product_id: grant.product_id, expires_at: grant.expires_at, status: "ACTIVE" },
                                update: { expires_at: grant.expires_at, status: "ACTIVE", updated_at: new Date() },
                            })
                        }
                        if (grants.length > 0) {
                            await prisma.desktop_whitelist_grants.deleteMany({ where: { email } }).catch(() => {})
                        }
                    } catch (error) {
                        reportAuthFailure("desktop grant claim failed", error)
                    }
                }

                user.id = dbUser.id
                user.email = email
                return true

            } catch (err) {
                reportAuthFailure("signIn error", err)
                return false
            }
        },

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async jwt({ token, user, account }: any) {
            // Checkout approvals have a hard lifetime even when useSession renews JWTs.
            if (token.provider === 'tikkies-checkout' && (!Number.isFinite(token.checkoutExpiresAt) || token.checkoutExpiresAt <= Math.floor(Date.now() / 1000))) return null
            if (token.provider === 'tikkies-checkout') {
                const buyer=await prisma.users.findUnique({where:{id:token.id},select:{role:true,nativeStatus:true}})
                if(!buyer||buyer.nativeStatus==='KICKED')return null
                token.role='user' // This credential cannot administer the store or read other buyers' orders.
                return token
            }
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
                    let dbUser = await prisma.users.findUnique({
                        where: { id: token.id as string },
                        select: { role: true },
                    })
                    // user แถวนี้ไม่มีแล้ว = ถูกรวมเข้าบัญชีหลัก (ล้าง user ซ้ำจากบั๊กอีเมลว่าง) → ย้าย session ไปบัญชีที่ผูกกับ provider account เดิม
                    // ลูกค้าไม่ต้องล็อกอินใหม่ก็กลับมาเห็นออเดอร์ของตัวเอง
                    if (!dbUser && token.provider && token.providerAccountId) {
                        const mergedInto = await findAccountUserId(prisma, token.provider as string, token.providerAccountId as string)
                        if (mergedInto) {
                            token.id = mergedInto
                            dbUser = await prisma.users.findUnique({ where: { id: mergedInto }, select: { role: true } })
                        }
                    }
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
            if(token.provider==='tikkies-checkout'||typeof token.checkoutOfferExpiresAt==='number'&&token.checkoutOfferExpiresAt>Math.floor(Date.now()/1000))session.user.checkoutOffer=token.checkoutOffer
            return session
        },
    },

    secret: process.env.NEXTAUTH_SECRET,
}
