"use client"

import { useEffect, useState, useCallback } from "react"

export default function ProductModal({ product, onClose }: any) {
  const [index, setIndex] = useState(0)

  const images =
    product.product_images?.length > 0
      ? product.product_images
      : [{ url: "/placeholder.png" }]

  const total = images.length

  const prev = useCallback(() => setIndex((p) => Math.max(p - 1, 0)), [])
  const next = useCallback(() => setIndex((p) => Math.min(p + 1, total - 1)), [total])

  // ESC to close
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape")       onClose()
      if (e.key === "ArrowLeft")    prev()
      if (e.key === "ArrowRight")   next()
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [onClose, prev, next])

  // lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = "" }
  }, [])

  // swipe support
  let touchStartX = 0
  const onTouchStart = (e: React.TouchEvent) => { touchStartX = e.touches[0].clientX }
  const onTouchEnd   = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX
    if (dx > 50)  prev()
    if (dx < -50) next()
  }

  const stockCount = product._count?.game_keys ?? 0
  const isLowStock = stockCount > 0 && stockCount <= 5
  const isOutOfStock = stockCount === 0

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-5"
      style={{ background: "rgba(4,10,18,.85)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="
          relative w-full bg-bg-card border-accent/20 overflow-y-auto
          /* mobile: bottom sheet */
          rounded-t-2xl max-h-[92dvh]
          /* sm+: centered modal */
          sm:rounded-2xl sm:max-w-2xl sm:max-h-[90vh]
          border
        "
        onClick={(e) => e.stopPropagation()}
        style={{ WebkitOverflowScrolling: "touch" }}
      >

        {/* ── drag handle (mobile only) ── */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 rounded-full bg-white/20" />
        </div>

        {/* ── CLOSE button ── */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 w-8 h-8 rounded-full bg-white/5 hover:bg-white/12 text-muted hover:text-white text-base flex items-center justify-center transition-colors"
          aria-label="Close"
        >
          ✕
        </button>

        {/* ── IMAGE SLIDER ── */}
        <div
          className="w-full overflow-hidden relative bg-bg-base"
          /* mobile: shorter ratio, sm+: 16/7 */
          style={{ aspectRatio: "16/8" }}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {/* track */}
          <div
            className="flex h-full transition-transform duration-300 ease-[cubic-bezier(.4,0,.2,1)]"
            style={{ transform: `translateX(-${index * 100}%)` }}
          >
            {images.map((img: any, i: number) => (
              <img
                key={i}
                src={img.url}
                alt={`screenshot-${i + 1}`}
                className="w-full h-full flex-shrink-0 object-cover"
                draggable={false}
              />
            ))}
          </div>

          {/* arrows — hidden when only 1 image */}
          {total > 1 && (
            <>
              <button
                onClick={prev}
                disabled={index === 0}
                className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center transition-all disabled:opacity-30"
                style={{ background: "rgba(7,16,26,.7)", border: "1px solid rgba(66,122,181,.25)", color: "#eef3f9", backdropFilter: "blur(4px)" }}
              >
                ‹
              </button>
              <button
                onClick={next}
                disabled={index === total - 1}
                className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center transition-all disabled:opacity-30"
                style={{ background: "rgba(7,16,26,.7)", border: "1px solid rgba(66,122,181,.25)", color: "#eef3f9", backdropFilter: "blur(4px)" }}
              >
                ›
              </button>
            </>
          )}

          {/* dots */}
          {total > 1 && (
            <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex gap-1.5 items-center">
              {images.map((_: any, i: number) => (
                <button
                  key={i}
                  onClick={() => setIndex(i)}
                  className="h-1.5 rounded-full transition-all"
                  style={{
                    width:      i === index ? 18 : 6,
                    background: i === index ? "#5b93cc" : "rgba(255,255,255,.3)",
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── CONTENT ── */}
        <div className="p-4 sm:p-6">

          {/* Tags */}
          <div className="flex gap-1.5 flex-wrap mb-2.5">
            {product.is_featured && (
              <span className="bg-gold text-[#1a0e00] text-[10px] font-bold px-2 py-0.5 rounded-full">HOT</span>
            )}
            {isLowStock && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(224,144,74,.15)", color: "#e0904a" }}>
                LOW STOCK
              </span>
            )}
            {isOutOfStock && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,.06)", color: "#7a9bb8" }}>
                OUT OF STOCK
              </span>
            )}
          </div>

          {/* Name */}
          <h2 className="font-display font-bold text-[22px] sm:text-[28px] leading-tight mb-2">
            {product.name_en}
          </h2>

          {/* Description */}
          <p className="text-muted text-[13px] sm:text-[14px] leading-relaxed mb-4">
            {product.description_en || "No description available."}
          </p>

          {/* Thumbnail strip */}
          {total > 1 && (
            <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-none">
              {images.map((img: any, i: number) => (
                <button
                  key={i}
                  onClick={() => setIndex(i)}
                  className="flex-shrink-0 rounded-lg overflow-hidden transition-all"
                  style={{
                    width: 64, height: 44,
                    border:   i === index ? "1.5px solid #5b93cc" : "1.5px solid rgba(66,122,181,.2)",
                    opacity:  i === index ? 1 : 0.6,
                  }}
                >
                  <img src={img.url} alt="" className="w-full h-full object-cover" draggable={false} />
                </button>
              ))}
            </div>
          )}

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(66,122,181,.15)" }}>
              <p className="text-[11px] text-muted mb-1">Keys in stock</p>
              <p
                className="text-[14px] font-medium"
                style={{ color: isOutOfStock ? "#7a9bb8" : isLowStock ? "#e0904a" : "#eef3f9" }}
              >
                {stockCount} keys
              </p>
            </div>
          </div>

          {/* Footer: price + buy */}
          <div className="flex items-center gap-3 pt-4" style={{ borderTop: "1px solid rgba(66,122,181,.15)" }}>
            <div className="flex-1 min-w-0">
              <div className="font-display font-bold text-[28px] sm:text-[32px] leading-none text-accent-l">
                ฿{Number(product.price).toLocaleString()}
              </div>
              {isLowStock && (
                <p className="text-[11px] mt-0.5" style={{ color: "#e0904a" }}>Only {stockCount} left!</p>
              )}
              {isOutOfStock && (
                <p className="text-[11px] mt-0.5 text-muted">Currently unavailable</p>
              )}
            </div>

            <button
              disabled={isOutOfStock}
              className="flex-1 font-medium text-[15px] sm:text-[16px] py-3 rounded-xl transition-all"
              style={
                isOutOfStock
                  ? { background: "rgba(255,255,255,.06)", color: "#7a9bb8", cursor: "default" }
                  : { background: "var(--color-accent)", color: "#fff" }
              }
            >
              {isOutOfStock ? "Out of Stock" : "Buy Now"}
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}