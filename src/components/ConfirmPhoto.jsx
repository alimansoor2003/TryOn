import GarmentCarousel from './GarmentCarousel.jsx';

/**
 * "Use this photo?" — the gate between taking a picture and spending a paid
 * model call on it.
 *
 * Worth its own step for two reasons. A blurred or badly framed shot produces a
 * bad try-on after a 30-second wait, and by then the shopper blames the app
 * rather than the photo. And it makes the flow's control explicit: nothing is
 * sent anywhere until someone looks at the picture and says yes.
 */
export default function ConfirmPhoto({ photo, garment, garments, onSelect, onConfirm, onRetake }) {
  if (!photo) return null;

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-neutral-950/96 backdrop-blur-sm">
      <header className="px-5 pb-3 pt-[calc(env(safe-area-inset-top)+1rem)] text-center">
        <h2 className="text-base font-semibold text-white">Use this photo?</h2>
        <p className="mt-1 text-xs text-white/50">
          Head to thigh, facing the camera, gives the best result
        </p>
      </header>

      <div className="flex flex-1 items-center justify-center overflow-hidden px-5">
        <img
          src={photo.dataUrl}
          alt="The photo you just took, before sending it for try-on"
          className="max-h-full max-w-full rounded-2xl object-contain shadow-2xl"
        />
      </div>

      <footer className="px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-4">
        {/*
          The carousel lives here as well as on the camera screen so "try another
          garment" does not mean "pose again". One photo, any number of items —
          which is also the difference between a demo someone watches once and
          one they keep pressing.
        */}
        <div className="-mx-5 mb-4">
          <GarmentCarousel garments={garments} activeId={garment.id} onSelect={onSelect} />
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onRetake}
            className="flex-1 rounded-full border border-white/20 py-3.5 text-sm font-medium text-white/85 transition hover:bg-white/10"
          >
            Retake
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-full bg-white py-3.5 text-sm font-semibold text-black transition active:scale-[0.98]"
          >
            Try on {garment.name}
          </button>
        </div>
        <p className="mt-3 text-center text-[10px] text-white/30">
          {photo.width}×{photo.height} · {(photo.bytes / 1024).toFixed(0)}KB
        </p>
      </footer>
    </div>
  );
}
