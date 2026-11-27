import NextAuth from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id:       string
      name?:    string | null
      email?:   string | null
      image?:   string | null
      role:     string
      provider: "discord" | "google" | string
      checkoutOffer?: {code:string;priceTHB:number;days:number|null}
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id:       string
    role:     string
    provider: string
  }
}
