export default function TopBar({ garment, onFlip, onBack }) {
  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-20 pt-[env(safe-area-inset-top)]">
      <div className="bg-gradient-to-b from-black/75 to-transparent px-4 pb-10 pt-3">
        <div className="flex items-start gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="Back"
              className="pointer-events-auto -ml-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-black/45 text-white/90 transition hover:bg-black/65"
            >
              <svg viewBox="0 0 24 24" className="size-4.5" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold tracking-tight text-white">
              {garment.name}
            </h1>
            <p className="truncate text-xs text-white/60">{garment.subtitle}</p>
          </div>

          <button
            type="button"
            onClick={onFlip}
            className="pointer-events-auto rounded-full bg-black/45 px-3.5 py-1.5 text-xs font-medium text-white/90 transition hover:bg-black/65"
          >
            Flip
          </button>
        </div>
      </div>
    </header>
  );
}
