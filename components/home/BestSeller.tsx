import ProductCard from "./ProductCard"

type Props = {
  products: any[]
}
export default async function BestSeller({products} : Props) {

    return (
        <section className="bg-bg-surface px-10 py-20">
            <div className="max-w-5xl mx-auto">
                <p className="text-[11px] tracking-widest text-accent-light uppercase font-medium mb-2">
                    Top Sellers
                </p>

                <h2
                    className="font-display font-bold mb-1"
                    style={{ fontSize: "clamp(26px, 4vw, 38px)" }}
                >
                    Best Selling Keys
                </h2>

                <p className="text-text-muted text-[13px] mb-8">
                    Updated daily · Instant delivery guaranteed
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3">
                    {products.length > 0 ? (
                        products.map((item) => (
                            <ProductCard
                                key={item.id}
                                name={item.name_en}
                                price={Number(item.price)}
                                image={item.product_images?.[0]?.url || "/placeholder.png"}
                                stock={item._count.game_keys}
                                is_low={item.isLower ?? false}
                                badge="Hot"
                            />
                        ))
                    ) : (
                        <div className="col-span-full text-center py-10 text-text-muted text-sm">
                            No featured products available
                        </div>
                    )}
                </div>

                <div className="flex justify-center mt-7">
                    <a
                        href="/products"
                        className="border border-accent/20 hover:border-accent-light text-text-muted hover:text-text-base text-[13px] px-6 py-2.5 rounded-lg transition-colors"
                    >
                        View all products →
                    </a>
                </div>
            </div>
        </section>
    )
}