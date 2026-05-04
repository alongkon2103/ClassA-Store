type Variant = {
  id: string
  label_th: string
  label_en: string
  price: number
  stock: number // เพิ่ม
}

type Props = {
  name: string
  price: number
  image: string
  badge?: string
  is_low?: boolean
  product_variants?: Variant[]
  onClick?: () => void
}

export default function ProductCard({
  name,
  price,
  image,
  badge,
  is_low,
  product_variants,
  onClick
}: Props) {
  // คำนวณ total stock จากทุก variant
  const totalStock = product_variants?.reduce((sum, v) => sum + v.stock, 0) ?? 0

  return (
    <div
      onClick={onClick}
      className="group bg-bg-card border border-accent/20 rounded-2xl overflow-hidden cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg"
    >
      {/* Image */}
      <div className="relative aspect-video overflow-hidden">
        <img
          src={image}
          alt={name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        {badge && (
          <span className="absolute top-2 right-2 bg-gold text-black text-[10px] font-bold px-2 py-0.5 rounded-full">
            {badge}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-3 space-y-2">
        <p className="text-[13px] font-medium line-clamp-1">{name}</p>

        {/* Variants พร้อม stock แต่ละตัว */}
        {product_variants && product_variants.length > 0 ? (
          <div className="space-y-1">
            {product_variants.slice(0, 3).map((v) => (
              <div key={v.id} className="flex justify-between text-[12px]">
                <span className="text-muted-foreground">
                  {v.label_en}
                  <span className={`ml-1 text-[10px] ${v.stock > 0 ? "text-green-400" : "text-red-400"}`}>
                    ({v.stock})
                  </span>
                </span>
                <span className="font-semibold text-accent-light">฿{v.price}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[16px] font-bold text-accent-light">฿{price}</div>
        )}

        <div className="h-px bg-white/5" />

        {/* Footer — total stock */}
        <div className="flex justify-between items-center text-[11px]">
          <span className="text-muted-foreground">Stock</span>
          <span className={`font-medium ${is_low ? "text-orange-400" : totalStock > 0 ? "text-green-400" : "text-red-400"}`}>
            {is_low ? "Low" : totalStock > 0 ? "Available" : "Out of stock"} ({totalStock})
          </span>
        </div>
      </div>
    </div>
  )
}