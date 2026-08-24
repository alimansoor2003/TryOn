import { useRef } from 'react';

/**
 * The screen a QR scan lands on.
 *
 * Deliberately light where the rest of the app is dark. This is the shopfront —
 * it has to read as a product page in the half-second after a scan, and a black
 * full-bleed camera does not. The camera stays dark because a viewfinder should
 * disappear around the picture.
 *
 * The floating cut-outs are the garment overlays, reused. They already have
 * transparent backgrounds, which is the whole reason this layout works: the
 * products sit on the page rather than in boxes on the page.
 */

/**
 * Scatter positions for the decorative cut-outs, as percentages.
 *
 * Hand-placed rather than randomised. Random scatter reliably drops something
 * behind the wordmark or crowds one corner, and a layout that reshuffles on
 * every render cannot be checked. These keep the centre column clear at every
 * width the app actually runs at.
 */
const SCATTER = [
  { top: '4%', left: '-14%', size: 'w-24 sm:w-36', rotate: '-14deg', delay: '0s' },
  { top: '9%', right: '-15%', size: 'w-28 sm:w-40', rotate: '11deg', delay: '.6s' },
  { bottom: '24%', left: '-16%', size: 'w-28 sm:w-40', rotate: '9deg', delay: '1.2s' },
  { bottom: '15%', right: '-13%', size: 'w-20 sm:w-32', rotate: '-8deg', delay: '.3s' },
];

export default function Landing({ garment, garments, matched, onSelect, onTakePhoto, onFile }) {
  const fileRef = useRef(null);

  // Decorate with the items the shopper did NOT scan, so the featured garment
  // appears exactly once and the page cannot look like a duplicate.
  const others = garments.filter((g) => g.id !== garment.id);
  const scatter = SCATTER.map((pos, i) => ({ ...pos, garment: others[i % others.length] }));

  return (
    <div className="absolute inset-0 overflow-y-auto overflow-x-hidden bg-[#f4f4f6] text-neutral-900">
      {/* Soft violet bloom behind the centre, the way the reference lifts its
          middle column off a flat background. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[38%] h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#5a31f4]/10 blur-3xl"
      />

      {/*
        The cut-outs are clipped by their own wrapper rather than by the
        scrolling container. Setting overflow-x on the scroller does not reliably
        contain them — the page still gains 40px of sideways scroll — and a
        landing page that drifts horizontally under a thumb feels broken before
        anyone has read it.
      */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {scatter.map((s, i) => (
          <img
            key={i}
            src={s.garment.thumb}
            alt=""
            className={`absolute ${s.size} animate-[drift_9s_ease-in-out_infinite] select-none opacity-25 drop-shadow-2xl sm:opacity-40`}
            style={{
              top: s.top,
              bottom: s.bottom,
              left: s.left,
              right: s.right,
              rotate: s.rotate,
              animationDelay: s.delay,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 mx-auto flex min-h-full w-full max-w-md flex-col items-center px-6 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-[calc(env(safe-area-inset-top)+2.5rem)]">
        <span className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-[11px] font-medium text-neutral-500 shadow-sm ring-1 ring-black/5">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          {matched ? 'Scanned in store' : 'Featured item'}
        </span>

        <h1 className="mt-5 text-5xl font-bold tracking-tight text-[#5a31f4]">tryon</h1>
        <p className="mt-2 text-center text-[13px] leading-relaxed text-neutral-500">
          See it on yourself before you change.
        </p>

        {/* The scanned item, stated plainly: what it is, and what it looks like. */}
        <div className="mt-7 w-full rounded-3xl bg-white p-5 shadow-xl shadow-black/[0.06] ring-1 ring-black/5">
          <div className="flex items-center justify-center">
            <img
              src={garment.thumb}
              alt={garment.name}
              className="h-44 w-auto object-contain drop-shadow-xl"
            />
          </div>

          <div className="mt-4 text-center">
            <span className="inline-block rounded-full bg-[#5a31f4]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#5a31f4]">
              {garment.category.replace('_', ' ')}
            </span>
            <h2 className="mt-2.5 text-lg font-semibold tracking-tight">{garment.name}</h2>
            <p className="mt-0.5 text-[13px] text-neutral-500">{garment.subtitle}</p>
          </div>
        </div>

        {/* Shaped like the reference's search bar, because it plays the same
            role: the one obvious thing to press on the page. */}
        <button
          type="button"
          onClick={onTakePhoto}
          className="group mt-6 flex w-full items-center justify-between gap-3 rounded-full bg-white py-2 pl-6 pr-2 text-left shadow-lg shadow-black/[0.07] ring-1 ring-black/5 transition active:scale-[0.99]"
        >
          <span className="text-[15px] font-medium text-neutral-700">Take a photo of yourself</span>
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#5a31f4] text-white transition group-hover:bg-[#4a27d4]">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M5 12h13M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </button>

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="mt-3 text-[13px] font-medium text-neutral-500 underline underline-offset-4 transition hover:text-neutral-800"
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

        {garments.length > 1 && (
          <div className="mt-9 w-full">
            <p className="mb-3 text-center text-[11px] font-medium uppercase tracking-wider text-neutral-400">
              Also available
            </p>
            <div className="flex justify-center gap-2.5">
              {garments.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => onSelect(g.id)}
                  aria-label={g.name}
                  aria-pressed={g.id === garment.id}
                  className={`flex size-16 items-center justify-center rounded-2xl bg-white p-1.5 shadow-sm transition ${
                    g.id === garment.id
                      ? 'ring-2 ring-[#5a31f4]'
                      : 'ring-1 ring-black/5 hover:ring-black/15'
                  }`}
                >
                  <img src={g.thumb} alt="" className="h-full w-full object-contain" />
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="mt-auto pt-8 text-center text-[11px] leading-relaxed text-neutral-400">
          Your photo is sent once to generate the try-on.
          <br />
          Nothing is stored or recorded.
        </p>
      </div>
    </div>
  );
}
