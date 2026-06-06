"use client"

// Small client wrapper for image assets shown on the order detail page.
// Server components can't attach onError handlers, but we want the same
// graceful broken-image fallback the order modal uses — so the card lives
// here and gets imported by the server page.

type Props = {
  assetUrl: string
  filename: string
  downloadLabel: string
}

export default function AssetThumbnailCard({ assetUrl, filename, downloadLabel }: Props) {
  return (
    <div className="group flex flex-col bg-bg-base/30 border border-accent/10 rounded-xl overflow-hidden transition-colors hover:border-violet-500/30">
      <a
        href={assetUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="relative block aspect-[4/3] bg-white/5 overflow-hidden"
        aria-label={filename}
      >
        <img
          src={assetUrl}
          alt=""
          loading="lazy"
          onError={(e) => {
            const img = e.currentTarget
            img.style.display = "none"
            const fallback = img.nextElementSibling as HTMLElement | null
            if (fallback) fallback.style.display = "flex"
          }}
          className="absolute inset-0 w-full h-full object-contain p-3"
        />
        <div
          style={{ display: "none" }}
          className="absolute inset-0 flex-col items-center justify-center gap-1 text-text-muted"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        </div>
      </a>
      <div className="flex items-center gap-2 px-3 py-2.5 border-t border-accent/10">
        <span className="text-[12px] font-medium truncate flex-1" title={filename}>
          {filename}
        </span>
        <a
          href={assetUrl}
          download={filename}
          className="shrink-0 inline-flex items-center justify-center w-7 h-7 bg-accent hover:bg-accent-light text-white rounded-md transition-colors"
          aria-label={downloadLabel}
          title={downloadLabel}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </a>
      </div>
    </div>
  )
}
