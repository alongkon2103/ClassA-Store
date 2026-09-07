"use client"

// ดาวคะแนน — ใช้ร่วมกันทั้งหน้าสินค้า / รีวิวของฉัน / modal รายละเอียดออเดอร์
export default function Stars({ value, size = 14, onPick }: { value: number; size?: number; onPick?: (n: number) => void }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <svg
          key={n}
          onClick={onPick ? () => onPick(n) : undefined}
          width={size} height={size} viewBox="0 0 24 24"
          className={`${n <= value ? "text-gold" : "text-border-light"} ${onPick ? "cursor-pointer hover:scale-110 transition-transform" : ""}`}
          fill="currentColor"
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </span>
  )
}
