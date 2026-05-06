export default function ShopHeads({ search, setSearch }: any) {
  return (
    <div className="bg-bg-surface border-b border-accent/20 px-10 py-8">
      <h1 className="font-display text-[32px] font-bold mb-1">
        All Interactive Games
      </h1>

 
      <div className="flex gap-2.5 flex-wrap items-center">

        {/* SEARCH (Original + added state) */}
        <div className="relative flex-1 max-w-xs">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm pointer-events-none"></span>

          <input
            type="text"
            placeholder="Search games..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-bg-card border border-accent/20 focus:border-accent-l text-tx placeholder:text-muted text-[13px] py-2.5 pl-9 pr-3 rounded-lg outline-none transition-colors"
          />
        </div>

        <span className="ml-auto text-[12px] text-muted">
          Showing {search ? "filtered" : "all"} products
        </span>
      </div>
    </div>
  )
}