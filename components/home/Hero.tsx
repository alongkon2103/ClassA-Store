"use client"

import { motion } from "framer-motion"
import { useTranslations } from "next-intl"

export default function Hero() {
    const t = useTranslations("Home")

    return (
        <section
            className="relative min-h-[72vh] flex flex-col items-center justify-center text-center px-6 sm:px-10 py-16 overflow-hidden">
            <div className="grid-bg absolute inset-0"></div>

            <div className="relative z-10 flex flex-col items-center">
                <motion.h1
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    className="font-display font-bold leading-none tracking-tight mb-4"
                    style={{ fontSize: "clamp(52px, 9vw, 96px)" }}
                >
                    Class A <span className="text-accent-light">Store</span>
                </motion.h1>
                
                <motion.p 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                    className="text-text-muted font-light text-base max-w-md mx-auto mb-8"
                >
                    {t("hero_subtitle")}
                </motion.p>
                
                <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="flex gap-3 flex-wrap justify-center"
                >
                    <button
                        className="bg-accent hover:bg-accent-light text-white font-medium text-[15px] px-7 py-3 rounded-xl transition-all hover:-translate-y-0.5 active:scale-95">
                        {t("browse_shop")}
                    </button>
                    <button
                        className="border border-accent/20 hover:border-accent-light text-text-base text-[15px] px-7 py-3 rounded-xl transition-colors active:scale-95">
                        {t("how_it_works")}
                    </button>
                </motion.div>
            </div>
        </section>
    )
}
