type Props = {
  name: string
  price: number
  image: string
  badge?: string
  stock?: number
  is_low?: Boolean
}

export default function ProductCard({
  name,
  price,
  image,
  badge,
  stock,
  is_low
}: Props) {
  return (
    <div className="group bg-bg-card border border-accent/20 rounded-2xl overflow-hidden cursor-pointer card-hover">

      {/* Image */}
      <div className="relative aspect-video overflow-hidden">
        <img
          src={image}
          alt={name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />

        {/* Badge */}
        {badge && (
          <span className="absolute top-2 right-2 bg-gold text-gold-text text-[10px] font-bold px-2 py-0.5 rounded-full">
            {badge}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-3">
        <p className="text-[13px] font-medium truncate mb-1.5">
          {name}
        </p>

        <div className="flex items-center justify-between">
          <span className="font-display font-bold text-[19px] text-accent-light">
            ฿{price}
          </span>

          {stock !== undefined && (
            <span
              className={`text-[11px] ${is_low ? "text-orange-400 font-semibold" : "text-stock-low"
                }`}
            >
              {stock} left
            </span>
          )}
        </div>
      </div>
    </div>
  )
}