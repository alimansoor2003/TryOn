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
 * Light, matching the landing screen. The camera is the only dark surface in the
 * app because a viewfinder should disappear around the picture; every screen
 * that is *about* something — the shopfront, this, the result — is a page.
 */
export default function ConfirmPhoto({ photo, garment, garments, onSelect, onConfirm, onRetake }) {
  if (!photo) return null;

  return (
    <div className="absolute inset-0 z-40 flex flex-col overflow-hidden bg-ground text-neutral-900">
      <FloatingGarments garments={garments} exclude={garment.id} density="light" />

      <header className="relative z-10 px-6 pb-4 pt-[calc(env(safe-area-inset-top)+1.5rem)] text-center">
        <h2 className="text-xl font-semibold tracking-tight">Use this photo?</h2>
        <p className="mt-1.5 text-[13px] text-neutral-500">
          Head to thigh, facing the camera, works best
        </p>
      </header>

      <div className="relative z-10 flex flex-1 items-center justify-center overflow-hidden px-6">
        <div className="rounded-3xl bg-white p-2.5 shadow-xl shadow-black/[0.08] ring-1 ring-black/5">
          <img
            src={photo.dataUrl}
            alt="The photo you just took, before sending it for try-on"
            className="max-h-[52vh] w-auto rounded-2xl object-contain"
          />
        </div>
      </div>

      <footer className="relative z-10 px-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-5">
        {/*
          The picker lives here as well as on the camera screen so "try another
          garment" does not mean "pose again". One photo, any number of items —
          which is also the difference between a demo someone watches once and
          one they keep pressing.
        */}
        {garments.length > 1 && (
          <div className="mb-5">
            <p className="mb-2.5 text-center text-[11px] font-medium uppercase tracking-wider text-neutral-400">
              Trying on
            </p>
            <div className="flex justify-center gap-2.5">
              {garments.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => onSelect(g.id)}
                  aria-label={g.name}
                  aria-pressed={g.id === garment.id}
                  className={`flex size-14 items-center justify-center rounded-2xl bg-white p-1.5 shadow-sm transition ${
                    g.id === garment.id
                      ? 'ring-2 ring-brand'
                      : 'ring-1 ring-black/5 hover:ring-black/15'
                  }`}
                >
                  <img src={g.thumb} alt="" className="h-full w-full object-contain" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Shaped like the landing screen's primary action, because it is the
            same gesture one step later: the one obvious thing to press. */}
        <button
          type="button"
          onClick={onConfirm}
          className="group flex w-full items-center justify-between gap-3 rounded-full bg-white py-2 pl-6 pr-2 text-left shadow-lg shadow-black/[0.07] ring-1 ring-black/5 transition active:scale-[0.99]"
        >
          <span className="min-w-0 truncate text-[15px] font-medium text-neutral-700">
            Try on {garment.name}
          </span>
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand text-white transition group-hover:bg-brand-dark">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M5 12h13M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </button>

        <button
          type="button"
          onClick={onRetake}
          className="mx-auto mt-3.5 block text-[13px] font-medium text-neutral-500 underline underline-offset-4 transition hover:text-neutral-800"
        >
          Retake photo
        </button>

        <p className="mt-4 text-center text-[10px] text-neutral-400">
          {photo.width}×{photo.height} · {(photo.bytes / 1024).toFixed(0)}KB
        </p>
      </footer>
    </div>
  );
}
