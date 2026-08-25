import FloatingGarments from './FloatingGarments.jsx';

/**
 * "Use this photo?" — the gate between taking a picture and spending a model
 * call on it.
 *
 * Worth its own step for two reasons. A blurred or badly framed shot produces a
 * bad try-on after a ~30-second wait, and by then the shopper blames the app
 * rather than the photo. And it makes the flow's control explicit: nothing is
 * sent anywhere until someone looks at the picture and says yes.
 *
 * Matches the landing screen's language, not the earlier violet one: white,
 * black text, a solid black pill for the one thing to press. Same phone-first
 * assumption too — full width up to 440px, drifting cut-outs filling the margin
 * only once there is a margin to fill.
 */
export default function ConfirmPhoto({ photo, garment, garments, onSelect, onConfirm, onRetake }) {
  if (!photo) return null;

  return (
    <div className="absolute inset-0 z-40 overflow-y-auto overflow-x-hidden bg-white text-neutral-900">
      <div className="pointer-events-none absolute inset-0 hidden lg:block">
        <FloatingGarments garments={garments} exclude={garment.id} density="light" />
      </div>

      <div className="relative mx-auto flex min-h-full w-full max-w-[440px] flex-col px-6 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-[calc(env(safe-area-inset-top)+1.5rem)]">
        <h1 className="text-[32px] font-bold leading-[0.95] tracking-[-0.03em]">
          Use this
          <br />
          photo?
        </h1>
        <p className="mt-2 text-[13px] text-neutral-500">
          Head to thigh, facing the camera, works best
        </p>

        <div className="mt-6 flex flex-1 items-center justify-center overflow-hidden">
          <div className="overflow-hidden rounded-[28px] bg-neutral-50 ring-1 ring-black/[0.06]">
            <img
              src={photo.dataUrl}
              alt="The photo you just took, before sending it for try-on"
              className="max-h-[46vh] w-auto object-contain"
            />
          </div>
        </div>

        {/*
          The picker lives here as well as on the camera screen so "try another
          garment" does not mean "pose again". One photo, any number of items —
          which is also the difference between a demo someone watches once and
          one they keep pressing.
        */}
        {garments.length > 1 && (
          <div className="mt-6 flex justify-center gap-2">
            {garments.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => onSelect(g.id)}
                aria-label={g.name}
                aria-pressed={g.id === garment.id}
                className={`flex size-12 items-center justify-center rounded-xl bg-neutral-50 p-1.5 transition ${
                  g.id === garment.id
                    ? 'ring-2 ring-neutral-900'
                    : 'ring-1 ring-black/[0.07] hover:ring-black/20'
                }`}
              >
                <img src={g.thumb} alt="" className="h-full w-full object-contain" />
              </button>
            ))}
          </div>
        )}

        <div className="mt-6">
          {/* Shaped exactly like the landing screen's primary action, because it
              is the same gesture one step later: the one obvious thing to press. */}
          <button
            type="button"
            onClick={onConfirm}
            className="flex w-full items-center justify-center gap-2.5 rounded-full bg-neutral-900 py-4 text-[15px] font-medium text-white transition active:scale-[0.99] hover:bg-neutral-800"
          >
            <svg viewBox="0 0 24 24" className="size-[19px]" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h13M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Try on {garment.name}
          </button>

          <button
            type="button"
            onClick={onRetake}
            className="mt-3 w-full rounded-full border border-neutral-200 py-3.5 text-[15px] font-medium text-neutral-700 transition hover:bg-neutral-50"
          >
            Retake photo
          </button>

          <p className="mt-3.5 text-center text-[10px] text-neutral-400">
            {photo.width}×{photo.height} · {(photo.bytes / 1024).toFixed(0)}KB
          </p>
        </div>
      </div>
    </div>
  );
}
