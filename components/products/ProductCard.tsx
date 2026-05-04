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
  image?: string
  is_low: boolean
  is_featured: boolean
  onClick?: () => void
  product_variants?: Variant[]
  // ลบ stock: number ออก
}

export default function ProductCard({
  name,
  price,
  image,
  is_low,
  product_variants,
  is_featured,
  onClick,
}: Props) {
  const totalStock = product_variants?.reduce((sum, v) => sum + (v.stock ?? 0), 0) ?? 0

  return (
    <div
      onClick={onClick}
      className="group bg-bg-card border border-accent/20 rounded-2xl overflow-hidden cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg"
    >
      <div className="relative aspect-video overflow-hidden">
        <img
          src={image || "/placeholder.png"}
          alt={name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        {is_featured && (
          <span className="absolute top-2 right-2 bg-gold text-black text-[10px] font-bold px-2 py-0.5 rounded-full">
            HOT
          </span>
        )}
      </div>

      <div className="p-3 space-y-2">
        <p className="text-[13px] font-medium line-clamp-1">{name}</p>

        {product_variants && product_variants.length > 0 ? (
          <div className="space-y-1">
            {product_variants.slice(0, 3).map((v) => (
              <div key={v.id} className="flex justify-between text-[12px]">
                <span className="text-muted-foreground">
                  {v.label_en}
                  <span className={`ml-1 text-[10px] ${v.stock > 0 ? "text-green-400" : "text-red-400"}`}>
                    ({v.stock ?? 0})
                  </span>
                </span>
                <span className="font-semibold text-accent-light">฿{v.price}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[14px] font-bold text-accent-light">฿{price}</div>
        )}

        <div className="h-px bg-white/5 my-1" />

        <div className="flex justify-between items-center text-[11px]">
          <span className="text-muted-foreground">Stock</span>
          <span className={`font-medium ${
            totalStock === 0 ? "text-red-400" : is_low ? "text-orange-400" : "text-green-400"
          }`}>
            {totalStock === 0 ? "Out of stock" : is_low ? "Low" : "Available"} ({totalStock})
          </span>
        </div>
      </div>
    </div>
  )
}