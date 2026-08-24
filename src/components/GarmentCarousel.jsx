export default function GarmentCarousel({ garments, activeId, onSelect }) {
  return (
    <div
      className="flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="radiogroup"
      aria-label="Choose a garment"
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
            className={`flex min-w-[8rem] shrink-0 snap-start items-center gap-2.5 rounded-2xl border px-2.5 py-2 text-left transition ${
              active ? 'border-white/85 bg-white/15' : 'border-white/15 bg-black/35 hover:border-white/35'
            }`}
          >
            {/*
              The cutout doubles as the thumbnail now that it is no longer being
              stamped onto a live video feed. A real picture of the garment reads
              faster than a colour dot, and these two black items would otherwise
              be near-indistinguishable swatches.
            */}
            <span
              className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg ring-1 ring-inset ring-white/15"
              style={{ backgroundColor: garment.swatch }}
            >
              <img
                src={garment.thumb}
                alt=""
                loading="lazy"
                className="h-full w-full object-contain p-0.5"
              />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-medium text-white">
                {garment.name}
              </span>
              <span className="block truncate text-[11px] text-white/55">{garment.subtitle}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
