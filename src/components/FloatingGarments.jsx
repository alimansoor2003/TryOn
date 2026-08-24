/**
 * The drifting garment backdrop, shared by every light screen.
 *
 * Lives in one place because it is the thing that makes the screens feel like
 * one product rather than four. Each screen picks a `density` instead of
 * hand-placing its own items, so the confirm and result screens cannot slowly
 * diverge from the landing page every time one of them is touched.
 *
 * The cut-outs are the garment overlays, reused. They already have transparent
 * backgrounds, which is what lets products sit ON the page rather than in boxes
 * on it — the detail that makes the reference layout work.
 */

/**
 * Hand-placed, not randomised.
 *
 * Random scatter reliably drops something behind the headline or crowds one
 * corner, and a layout that reshuffles on every render cannot be verified. Each
 * entry also carries its own duration and delay: items moving in lockstep read
 * as one sliding sheet, which is worse than not animating at all.
 */
const FIELD = [
  { top: '3%', left: '-13%', w: 'w-24 sm:w-36', rot: '-14deg', dur: '11s', delay: '0s', card: false },
  { top: '7%', right: '-14%', w: 'w-28 sm:w-40', rot: '12deg', dur: '13s', delay: '.8s', card: false },
  { top: '30%', left: '-17%', w: 'w-20 sm:w-32', rot: '8deg', dur: '9s', delay: '1.6s', card: false },
  { top: '26%', right: '-16%', w: 'w-24 sm:w-36', rot: '-9deg', dur: '12s', delay: '.4s', card: true },
  { bottom: '22%', left: '-15%', w: 'w-28 sm:w-40', rot: '10deg', dur: '10s', delay: '2.1s', card: true },
  { bottom: '14%', right: '-13%', w: 'w-20 sm:w-32', rot: '-11deg', dur: '14s', delay: '1.1s', card: false },
  { bottom: '4%', left: '6%', w: 'w-16 sm:w-24', rot: '-6deg', dur: '12s', delay: '2.6s', card: false },
  { top: '15%', left: '12%', w: 'w-14 sm:w-20', rot: '15deg', dur: '10s', delay: '3.1s', card: false },
];

/** How much of the field each screen shows. Busier pages take fewer. */
const DENSITY = { full: 8, medium: 6, light: 4 };

export default function FloatingGarments({ garments, exclude, density = 'full' }) {
  // Never decorate with the item the screen is already featuring — it reads as
  // a duplicate rather than as a backdrop.
  const pool = garments.filter((g) => g.id !== exclude);
  const source = pool.length ? pool : garments;
  const items = FIELD.slice(0, DENSITY[density] ?? DENSITY.full);

  return (
    // Clipped by its own wrapper rather than by the page. Setting overflow-x on
    // a scrolling container does not contain these — the page still gains real
    // sideways scroll, which shifts everything off-centre under a thumb.
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {items.map((item, i) => {
        const garment = source[i % source.length];
        return (
          <div
            key={i}
            className={`absolute ${item.w} animate-[drift_var(--dur)_ease-in-out_infinite] opacity-25 sm:opacity-40`}
            style={{
              top: item.top,
              bottom: item.bottom,
              left: item.left,
              right: item.right,
              rotate: item.rot,
              '--dur': item.dur,
              animationDelay: item.delay,
            }}
          >
            {item.card ? (
              <div className="rounded-2xl bg-white p-2.5 shadow-xl shadow-black/5 ring-1 ring-black/5">
                <img src={garment.thumb} alt="" className="h-full w-full object-contain" />
              </div>
            ) : (
              <img src={garment.thumb} alt="" className="h-full w-full object-contain drop-shadow-2xl" />
            )}
          </div>
        );
      })}
    </div>
  );
}
