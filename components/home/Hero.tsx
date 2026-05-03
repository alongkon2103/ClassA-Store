export default function Hero() {
    return (
        <section
            className="relative min-h-[72vh] flex flex-col items-center justify-center text-center px-10 py-16 overflow-hidden">
            <div className="grid-bg absolute inset-0"></div>

            <div className="relative z-10 flex flex-col items-center">
                <h1
                    className="font-display font-bold leading-none tracking-tight mb-4 fade-up-1"
                    style={{ fontSize: "clamp(52px, 9vw, 96px)" }}
                >
                    Class A <span className="text-accent-light">Store</span>
                </h1>
                <p className="text-text-muted font-light text-base max-w-md mx-auto mb-8 fade-up-2">
                    Your trusted Interactive games store — instant delivery, every time.
                </p>
                <div className="flex gap-3 flex-wrap justify-center fade-up-3">
                    <button
                        className="bg-accent hover:bg-accent-light text-white font-medium text-[15px] px-7 py-3 rounded-xl transition-all hover:-translate-y-0.5">
                        Browse Shop
                    </button>
                    <button
                        className="border border-accent/20 hover:border-accent-light text-text-base text-[15px] px-7 py-3 rounded-xl transition-colors">
                        How it works
                    </button>
                </div>
            </div>
        </section>
    )
}