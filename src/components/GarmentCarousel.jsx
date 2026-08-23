export default function GarmentCarousel({ garments, activeId, onSelect }) {
  return (
    <div
      className="flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="radiogroup"
      aria-label="Choose a suit"
    >
      {garments.map((garment) => {
        const active = garment.id === activeId;
        return (
          <button
            key={garment.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onSelect(garment.id)}
            className={`flex min-w-[7.5rem] shrink-0 snap-start items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left transition ${
              active
                ? 'border-white/85 bg-white/15'
                : 'border-white/15 bg-black/35 hover:border-white/35'
            }`}
          >
            <span
              className="size-8 shrink-0 rounded-full ring-1 ring-inset ring-white/25"
              style={{ backgroundColor: garment.swatch }}
            />
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-medium text-white">
                {garment.name}
              </span>
              <span className="block truncate text-[11px] text-white/55">
                {garment.subtitle}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
