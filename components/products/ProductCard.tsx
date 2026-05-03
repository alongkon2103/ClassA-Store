type Props = {
    name: string
    price: number
    image?: string
    stock: number
    is_low: boolean
    is_featured: boolean
    onClick?: () => void
}

export default function ProductCard({
    name,
    price,
    image,
    stock,
    is_low,
    is_featured,
    onClick,
}: Props) {
    return (
        <div
            onClick={onClick}
            className="card-hover bg-bg-card border border-accent/20 rounded-2xl overflow-hidden cursor-pointer fade-up transition hover:scale-[1.02]"
        >
            
            <div className="relative aspect-video flex items-center justify-center text-3xl">
                <img className="w-full h-full object-cover" src={image || "/placeholder.png"} />
                {is_featured && (
                    <span className="bg-gold text-black text-[10px] font-bold px-2 py-0.5 rounded-full absolute top-2 right-2">
                        HOT
                    </span>
                )}

            </div>

            <div className="p-3">
                <p className="text-[13px] font-medium truncate mb-1.5">{name}</p>

                <div className="flex items-center justify-between">
                    <span className="font-display font-bold text-[19px] text-accent-light">
                        ฿{price}
                    </span>



                    <span
                        className={`text-[11px] ${is_low ? "text-orange-400 font-semibold" : "text-stock-low"
                            }`}
                    >
                        {stock} left
                    </span>



                </div>
            </div>
        </div>
    )
}