import { useEffect, useState } from 'react';
import FloatingGarments from './FloatingGarments.jsx';

/**
 * Full-screen surface covering the whole AI try-on lifecycle: waiting, the
 * result, and failure.
 *
 * One component rather than three because they are the same surface at
 * different moments — splitting them meant unmounting and remounting a
 * full-screen layer mid-flow, which flashes.
 *
 * Black and white, matching the landing and confirm screens. The camera is the
 * only dark surface in the app; everything that is *about* something is a page.
 */

/**
 * Staged reassurance while the model runs. Timed to the shape of a real request
 * rather than a fixed countdown: a warm run finishes in about twenty seconds, a
 * cold start takes longer, and we cannot tell which we are in until it returns.
 * A countdown that hits zero and keeps going looks broken; elapsed time that
 * keeps moving does not.
 */
const STAGES = [
  { after: 0, text: 'Sending your photo…' },
  { after: 3, text: 'Tailoring your garment with AI…' },
  { after: 10, text: 'Fitting it to your body…' },
  { after: 20, text: 'Rendering fabric and shadows…' },
  { after: 35, text: 'Almost there — the first run is the slowest.' },
];

function stageFor(seconds) {
  let current = STAGES[0].text;
  for (const s of STAGES) if (seconds >= s.after) current = s.text;
  return current;
}

/**
 * Saving the result.
 *
 * Fetching into a blob first is what makes the filename stick. With the
 * Hugging Face provider the image already arrives as a same-origin data URL, so
 * this succeeds outright; the fallback matters for providers that return a
 * cross-origin link, where opening in a tab still lets the shopper long-press to
 * save — which is how people save images on a phone anyway.
 */
async function saveImage(url, filename) {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoke on a later tick; revoking synchronously races the download start in
    // some browsers and silently produces a zero-byte file.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
    return 'saved';
  } catch {
    window.open(url, '_blank', 'noopener');
    return 'opened';
  }
}

/** Shared page frame, so the three states cannot drift apart visually. */
function Sheet({ garments, exclude, children }) {
  return (
    <div className="absolute inset-0 z-40 overflow-y-auto overflow-x-hidden bg-white text-neutral-900">
      <div className="pointer-events-none absolute inset-0 hidden lg:block">
        <FloatingGarments garments={garments} exclude={exclude} density="light" />
      </div>
      <div className="relative mx-auto flex min-h-full w-full max-w-[440px] flex-col px-6 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-[calc(env(safe-area-inset-top)+1.5rem)]">
        {children}
      </div>
    </div>
  );
}

export default function TryOnResult({
  status,
  result,
  captured,
  error,
  elapsed,
  garment,
  garments = [],
  onRetry,
  onClose,
  onCancel,
  onRetake,
}) {
  const [showBefore, setShowBefore] = useState(false);
  const [saveState, setSaveState] = useState('idle');

  useEffect(() => {
    setShowBefore(false);
    setSaveState('idle');
  }, [result]);

  if (status === 'idle') return null;

  if (status === 'processing') {
    return (
      <Sheet garments={garments} exclude={garment.id}>
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          {/* The garment itself is the loading indicator. It is what the shopper
              is waiting for, which beats a neutral spinner at saying so. */}
          <img
            src={garment.thumb}
            alt=""
            className="h-40 w-auto animate-[drift_3s_ease-in-out_infinite] object-contain drop-shadow-2xl"
          />

          <p className="mt-10 text-[20px] font-bold tracking-[-0.02em]">{stageFor(elapsed)}</p>

          {/*
            An indeterminate bar, not a percentage. We genuinely do not know how
            long this takes — a warm model finishes in about twenty seconds, a
            cold start takes longer — and a fake percentage that stalls at 90% is
            worse than one that never claimed to know.
          */}
          <div className="mt-5 h-1 w-52 overflow-hidden rounded-full bg-neutral-100">
            <div className="h-full w-1/3 animate-[indeterminate_1.6s_ease-in-out_infinite] rounded-full bg-neutral-900" />
          </div>
          <p className="mt-3 font-mono text-xs tabular-nums text-neutral-400">
            {elapsed.toFixed(1)}s
          </p>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="w-full rounded-full border border-neutral-200 py-3.5 text-[15px] font-medium text-neutral-700 transition hover:bg-neutral-50"
        >
          Cancel
        </button>
      </Sheet>
    );
  }

  if (status === 'error') {
    return (
      <Sheet garments={garments} exclude={garment.id}>
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-rose-50 text-2xl text-rose-500">
            !
          </div>
          <h1 className="mt-6 text-[32px] font-bold leading-[0.95] tracking-[-0.03em]">
            Try-on
            <br />
            failed
          </h1>
          <p className="mt-3 max-w-[320px] text-[13px] leading-relaxed text-neutral-500">
            {error?.message}
          </p>
          {error?.code && (
            <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-neutral-300">
              {error.code}
            </p>
          )}
        </div>

        <div>
          <button
            type="button"
            onClick={onRetry}
            className="flex w-full items-center justify-center gap-2.5 rounded-full bg-neutral-900 py-4 text-[15px] font-medium text-white transition active:scale-[0.99] hover:bg-neutral-800"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={onRetake}
            className="mt-3 w-full rounded-full border border-neutral-200 py-3.5 text-[15px] font-medium text-neutral-700 transition hover:bg-neutral-50"
          >
            Retake photo
          </button>
        </div>
      </Sheet>
    );
  }

  if (status === 'done' && result) {
    return (
      <Sheet garments={garments} exclude={garment.id}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[32px] font-bold leading-[0.95] tracking-[-0.03em]">
              {showBefore ? 'Your photo' : 'Here you go'}
            </h1>
            <p className="mt-1.5 truncate text-[13px] text-neutral-500">{garment.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-lg leading-none text-neutral-500 transition hover:text-neutral-900"
          >
            ×
          </button>
        </div>

        <div className="mt-5 flex flex-1 items-center justify-center overflow-hidden">
          <div className="relative animate-[reveal_.5s_ease-out] overflow-hidden rounded-[28px] bg-neutral-50 ring-1 ring-black/[0.06]">
            <img
              src={showBefore ? captured : result.image}
              alt={showBefore ? 'The photo you captured' : `AI try-on of ${garment.name}`}
              className="max-h-[46vh] w-auto object-contain"
            />
            {captured && (
              <button
                type="button"
                onClick={() => setShowBefore((v) => !v)}
                className="absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-neutral-900/85 px-4 py-2 text-xs font-medium text-white backdrop-blur transition hover:bg-neutral-900"
              >
                {showBefore ? 'Show result' : 'Compare'}
              </button>
            )}
          </div>
        </div>

        <div className="mt-6">
          <button
            type="button"
            onClick={async () => {
              setSaveState('saving');
              const how = await saveImage(result.image, `tryon-${garment.id.toLowerCase()}.png`);
              setSaveState(how);
              setTimeout(() => setSaveState('idle'), 2500);
            }}
            className="flex w-full items-center justify-center gap-2.5 rounded-full bg-neutral-900 py-4 text-[15px] font-medium text-white transition active:scale-[0.99] hover:bg-neutral-800"
          >
            <svg viewBox="0 0 24 24" className="size-[19px]" fill="none" stroke="currentColor" strokeWidth="1.9">
              <path d="M12 4v12m0 0l-5-5m5 5l5-5M4 20h16" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {saveState === 'saving'
              ? 'Saving…'
              : saveState === 'saved'
                ? 'Saved to your phone'
                : saveState === 'opened'
                  ? 'Opened — long-press to save'
                  : 'Save photo'}
          </button>

          <div className="mt-3 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-full border border-neutral-200 py-3.5 text-[14px] font-medium text-neutral-700 transition hover:bg-neutral-50"
            >
              Try another
            </button>
            <button
              type="button"
              onClick={onRetake}
              className="flex-1 rounded-full border border-neutral-200 py-3.5 text-[14px] font-medium text-neutral-700 transition hover:bg-neutral-50"
            >
              Retake
            </button>
          </div>

          <p className="mt-3.5 text-center text-[10px] text-neutral-400">
            AI-generated · {result.ms ? `${(result.ms / 1000).toFixed(1)}s` : 'may not be exact'}
          </p>
        </div>
      </Sheet>
    );
  }

  return null;
}
