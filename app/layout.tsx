import "./globals.css"
import Providers from "@/components/home/Providers"
import { Rajdhani, DM_Sans } from "next/font/google"

const rajdhani = Rajdhani({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-display",
})

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-body",
})

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${rajdhani.variable} ${dmSans.variable}`}>
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}