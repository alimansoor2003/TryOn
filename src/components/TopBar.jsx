export default function TopBar({ garment, fps, tracking, onFlip, onToggleTune, tuning }) {
  const fpsTone =
    fps >= 24 ? 'text-emerald-300' : fps >= 15 ? 'text-amber-300' : 'text-rose-300';

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

          <div className="pointer-events-auto flex items-center gap-2">
            <span
              className={`rounded-full bg-black/45 px-2.5 py-1 font-mono text-[11px] tabular-nums ${fpsTone}`}
              title="Live frame rate. The PRD floor is 24fps."
            >
              {fps || '--'} fps
            </span>
            <button
              type="button"
              onClick={onToggleTune}
              aria-pressed={tuning}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                tuning ? 'bg-white text-black' : 'bg-black/45 text-white/90 hover:bg-black/65'
              }`}
            >
              Fit
            </button>
            <button
              type="button"
              onClick={onFlip}
              className="rounded-full bg-black/45 px-3 py-1.5 text-xs font-medium text-white/90 transition hover:bg-black/65"
            >
              Flip
            </button>
          </div>
        </div>

        {!tracking && (
          <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-black/55 px-3 py-1.5 text-xs text-white/80">
            <span className="size-1.5 animate-pulse rounded-full bg-amber-300" />
            Step back until your shoulders and hips are in frame
          </p>
        )}
      </div>
    </header>
  );
}
