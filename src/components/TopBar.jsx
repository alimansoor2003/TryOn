export default function TopBar({ garment, onFlip }) {
  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-20 pt-[env(safe-area-inset-top)]">
      <div className="bg-gradient-to-b from-black/75 to-transparent px-4 pb-10 pt-3">
        <div className="flex items-start gap-3">
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
