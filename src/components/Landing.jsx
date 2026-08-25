import { useRef } from 'react';

/**
 * The screen a QR scan lands on, built to the Shop reference layout.
 *
 * Three kinds of object share the canvas, which is what gives the reference its
 * depth — a page of uniform cards reads as a grid, not a shopfront:
 *
 *   cutout  transparent PNG, no container. Sits ON the page.
 *   card    white panel, product, title, rating.
 *   tile    full-bleed photo, rounded, brand name over it.
 *
 * Positions are hand-placed percentages rather than a grid or a randomiser.
 * Random scatter reliably drops something behind the wordmark, and a layout that
 * reshuffles every render cannot be checked against the reference.
 */

/**
 * Ratings are placeholder demo data, not real reviews.
 *
 * They exist because the reference has them and the layout reads wrong without
 * that line of text under a title. Replace them with real values — or delete the
 * `rating` field, which the card handles — before this is shown to shoppers as a
 * live storefront. Invented review counts on a real product page are the kind of
 * thing that is fine in a prototype and not fine in a shop.
 */
const SCATTER = [
  // --- upper band -----------------------------------------------------------
  // Sizes deliberately span 3.5x, from hero cut-out down to accent. The
  // reference puts a huge handbag next to a thumbnail-sized dog; without that
  // spread the page flattens into a grid of similar rectangles.
  { kind: 'card', g: 0, x: '5%', y: '13%', w: 'w-[176px]', rot: '-3deg', dur: '13s', d: '0s', rating: 4.5, count: '227' },
  { kind: 'tile', g: 1, x: '19%', y: '7%', w: 'w-[124px]', rot: '2deg', dur: '11s', d: '.7s', label: 'STUDIO' },
  { kind: 'cutout', g: 2, x: '32%', y: '3%', w: 'w-[186px]', rot: '-5deg', dur: '15s', d: '.3s' },
  { kind: 'cutout', g: 0, x: '49%', y: '5%', w: 'w-[152px]', rot: '6deg', dur: '12s', d: '1.4s' },
  { kind: 'cutout', g: 1, x: '62%', y: '13%', w: 'w-[128px]', rot: '-8deg', dur: '10s', d: '2s' },
  { kind: 'cutout', g: 2, x: '67%', y: '30%', w: 'w-[54px]', rot: '10deg', dur: '9s', d: '2.9s' },
  { kind: 'card', g: 2, x: '76%', y: '5%', w: 'w-[184px]', rot: '3deg', dur: '14s', d: '.5s', rating: 5, count: '38.5K' },
  { kind: 'tile', g: 0, x: '87%', y: '26%', w: 'w-[132px]', rot: '-4deg', dur: '12s', d: '1.8s', label: 'ADICOLOR' },

  // --- lower band -----------------------------------------------------------
  { kind: 'tile', g: 1, x: '10%', y: '64%', w: 'w-[122px]', rot: '4deg', dur: '13s', d: '1.1s', label: 'ESSENTIALS' },
  { kind: 'card', g: 0, x: '16%', y: '66%', w: 'w-[176px]', rot: '-2deg', dur: '11s', d: '2.4s', rating: 4.5, count: '52' },
  { kind: 'cutout', g: 2, x: '36%', y: '68%', w: 'w-[150px]', rot: '5deg', dur: '14s', d: '.9s' },
  { kind: 'cutout', g: 1, x: '30%', y: '86%', w: 'w-[62px]', rot: '-7deg', dur: '10s', d: '1.6s' },
  { kind: 'cutout', g: 0, x: '61%', y: '68%', w: 'w-[144px]', rot: '4deg', dur: '13s', d: '2.8s' },
  { kind: 'tile', g: 2, x: '76%', y: '67%', w: 'w-[128px]', rot: '-3deg', dur: '12s', d: '.2s', label: 'SPORT' },
  { kind: 'card', g: 1, x: '86%', y: '64%', w: 'w-[172px]', rot: '2deg', dur: '15s', d: '1.3s', rating: 4, count: '2' },
];

/**
 * Phone layout, kept as its own set rather than as overrides on the desktop one.
 *
 * The desktop canvas is ~1356px wide and the phone canvas is 375px: the same
 * percentages put an item at the left margin on one and directly behind the
 * wordmark on the other. Sizes are roughly half, and everything is anchored to
 * the edges so the centre column stays clear at the only width that matters for
 * a QR scan.
 */
const SCATTER_MOBILE = [
  { kind: 'cutout', g: 0, x: '-12%', y: '4%', w: 'w-[104px]', rot: '-12deg', dur: '11s', d: '0s' },
  { kind: 'cutout', g: 1, x: '74%', y: '2%', w: 'w-[112px]', rot: '10deg', dur: '13s', d: '.9s' },
  { kind: 'cutout', g: 2, x: '-14%', y: '68%', w: 'w-[108px]', rot: '9deg', dur: '12s', d: '1.7s' },
  { kind: 'cutout', g: 0, x: '76%', y: '72%', w: 'w-[100px]', rot: '-8deg', dur: '10s', d: '.5s' },
  { kind: 'cutout', g: 1, x: '8%', y: '26%', w: 'w-[52px]', rot: '14deg', dur: '9s', d: '2.3s' },
  { kind: 'cutout', g: 2, x: '80%', y: '40%', w: 'w-[48px]', rot: '-15deg', dur: '14s', d: '3s' },
];

function Stars({ value }) {
  return (
    <span className="flex items-center gap-[1px]">
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} viewBox="0 0 20 20" className="size-[11px]" aria-hidden>
          <path
            d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9z"
            fill={i < Math.round(value) ? '#f5b301' : '#e2e2e6'}
          />
        </svg>
      ))}
    </span>
  );
}

function ScatterItem({ item, garment, className = '' }) {
  const common = {
    className: `absolute ${item.w} ${className} animate-[drift_var(--dur)_ease-in-out_infinite]`,
    style: {
      left: item.x,
      top: item.y,
      rotate: item.rot,
      '--dur': item.dur,
      animationDelay: item.d,
    },
  };

  if (item.kind === 'card') {
    return (
      <div {...common}>
        <div className="rounded-[18px] bg-white p-2.5 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.18)]">
          <div className="flex aspect-square items-center justify-center rounded-xl bg-[#f6f6f7] p-3">
            <img src={garment.thumb} alt="" className="h-full w-full object-contain" />
          </div>
          <p className="mt-2 truncate px-0.5 text-[12px] font-medium text-neutral-800">
            {garment.name}
          </p>
          <div className="mt-0.5 flex items-center gap-1 px-0.5">
            <Stars value={item.rating} />
            <span className="text-[11px] text-neutral-500">({item.count})</span>
          </div>
        </div>
      </div>
    );
  }

  if (item.kind === 'tile') {
    return (
      <div {...common}>
        <div className="relative aspect-square overflow-hidden rounded-[18px] shadow-[0_18px_40px_-12px_rgba(0,0,0,0.2)]">
          <img src={garment.tile} alt="" className="h-full w-full object-cover" />
          <span className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/45 via-black/5 to-transparent pb-3">
            <span className="text-[12px] font-semibold tracking-[0.14em] text-white drop-shadow-md">
              {item.label}
            </span>
          </span>
        </div>
      </div>
    );
  }

  return (
    <div {...common}>
      <img src={garment.thumb} alt="" className="h-full w-full object-contain drop-shadow-2xl" />
    </div>
  );
}

/** Left rail. Decorative on this screen — the flow has one entry point. */
function Sidebar() {
  const icons = [
    'M4 10.5L12 4l8 6.5V20a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1z',
    'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
    'M3 5h2l2.4 10.2a1.5 1.5 0 001.5 1.2h7.6a1.5 1.5 0 001.5-1.2L20 8H6',
    'M3 11l8-8 10 10-8 8zM8.5 7.5h.01',
    'M12 20.5S3.5 15 3.5 9.2A4.7 4.7 0 0112 6.8a4.7 4.7 0 018.5 2.4c0 5.8-8.5 11.3-8.5 11.3z',
  ];
  return (
    <aside className="hidden w-[76px] shrink-0 flex-col items-center py-6 lg:flex">
      <span className="flex size-9 items-center justify-center rounded-full bg-brand">
        <span className="size-3.5 rounded-full border-[3px] border-white" />
      </span>
      <nav className="mt-14 flex flex-col items-center gap-8">
        {icons.map((d, i) => (
          <span
            key={i}
            className={i === 0 ? 'text-neutral-900' : 'text-neutral-300'}
            aria-hidden
          >
            <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d={d} />
            </svg>
          </span>
        ))}
      </nav>
      <span className="mt-auto flex size-9 items-center justify-center rounded-full bg-neutral-100 text-[13px] font-medium text-neutral-500 ring-1 ring-black/5">
        {'—'}
      </span>
    </aside>
  );
}

export default function Landing({ garment, garments, matched, onSelect, onTakePhoto, onFile }) {
  const fileRef = useRef(null);

  // Decorate with the items the shopper did NOT scan, so the featured garment
  // appears once in the centre and the page cannot look like a duplicate.
  const others = garments.filter((g) => g.id !== garment.id);
  const pool = others.length ? others : garments;

  return (
    <div className="absolute inset-0 flex overflow-hidden bg-white">
      <Sidebar />

      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-[#f7f7f8] lg:my-2 lg:mr-2 lg:rounded-2xl">
        {/* Black promo bar, exactly as the reference opens. */}
        <div className="flex shrink-0 items-center justify-center gap-2.5 bg-black px-4 py-2.5 text-white lg:rounded-t-2xl">
          <span className="flex size-5 shrink-0 items-center justify-center rounded bg-brand text-[9px] font-bold">
            t
          </span>
          <p className="truncate text-[12px] sm:text-[13px]">
            <span className="font-semibold">{matched ? 'Scanned in store.' : 'tryon.'}</span>{' '}
            <span className="text-white/70">See it on before you change.</span>
          </p>
          <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h13M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {/* Scatter canvas. Clipped by its own wrapper so nothing it holds can
            give the page real horizontal scroll. */}
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            {SCATTER.map((item, i) => (
              <ScatterItem
                key={`d${i}`}
                item={item}
                garment={pool[item.g % pool.length]}
                className="hidden lg:block"
              />
            ))}
            {SCATTER_MOBILE.map((item, i) => (
              <ScatterItem
                key={`m${i}`}
                item={item}
                garment={pool[item.g % pool.length]}
                className="lg:hidden opacity-60"
              />
            ))}
          </div>

          {/* Centre column: wordmark, then the one obvious thing to press. */}
          <div className="relative z-10 flex h-full flex-col items-center justify-center px-6">
            <h1 className="text-[64px] font-bold leading-none tracking-[-0.04em] text-brand sm:text-[84px]">
              tryon
            </h1>

            <button
              type="button"
              onClick={onTakePhoto}
              className="group mt-7 flex w-full max-w-[560px] items-center justify-between gap-3 rounded-full bg-white py-2.5 pl-7 pr-2.5 text-left shadow-[0_16px_44px_-10px_rgba(0,0,0,0.16)] transition active:scale-[0.995]"
            >
              <span className="truncate text-[15px] text-neutral-500 sm:text-[17px]">
                Take a photo to try it on
              </span>
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand text-white transition group-hover:bg-brand-dark sm:size-12">
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M5 12h13M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </button>

            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="mt-4 text-[13px] font-medium text-neutral-400 underline underline-offset-4 transition hover:text-neutral-700"
            >
              or upload a photo from your gallery
            </button>
            {/* No `capture` attribute: adding it forces the OS camera and removes
                the point of offering an existing photo. */}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) onFile(file);
              }}
            />
          </div>

          {/* The scanned item, and the switcher. The reference puts pagination
              dots here; this page has something more useful to say in that slot. */}
          <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-3 pb-5">
            <div className="flex items-center gap-2.5 rounded-full bg-white/85 px-2.5 py-2 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.2)] backdrop-blur">
              {garments.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => onSelect(g.id)}
                  aria-label={g.name}
                  aria-pressed={g.id === garment.id}
                  className={`flex size-11 items-center justify-center rounded-full bg-[#f6f6f7] p-1.5 transition ${
                    g.id === garment.id ? 'ring-2 ring-brand' : 'ring-1 ring-black/5 hover:ring-black/20'
                  }`}
                >
                  <img src={g.thumb} alt="" className="h-full w-full object-contain" />
                </button>
              ))}
            </div>
            <p className="rounded-full bg-white/85 px-3 py-1 text-center text-[11px] text-neutral-500 shadow-sm backdrop-blur">
              <span className="font-medium text-neutral-800">{garment.name}</span> ·{' '}
              {garment.subtitle}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
