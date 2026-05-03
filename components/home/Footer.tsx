export default function Footer() {
  return (
     <footer className="px-10 py-5 border-t border-accent/20 flex items-center justify-between flex-wrap gap-3">
    <div className="font-display text-[15px] font-bold text-text-muted">
      Class A <span className="text-accent-light">Store</span>
    </div>
    <p className="text-[12px] text-text-muted">© 2026 Class A Store · Payments secured by Stripe</p>
  </footer>
  )
}
