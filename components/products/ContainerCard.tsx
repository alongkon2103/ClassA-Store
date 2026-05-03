import ProductCard from "./ProductCard"

export default function ContainerCard({ products, onSelect }: any) {
    return (
        <div className="px-10 py-8 pb-20">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">

                {products.map((item: any) => (
                    <div key={item.id}>
                        <ProductCard
                            name={item.name_en}
                            price={item.price}
                            image={item.product_images?.[0]?.url}
                            stock={item._count.game_keys}
                            is_low={item.isLower}
                            onClick={() => onSelect(item)}
                            is_featured={item.is_featured}
                        />
                    </div>
                ))}

            </div>
        </div>
    )
}