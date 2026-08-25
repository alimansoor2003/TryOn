import { useEffect, useState } from 'react';
import FloatingGarments from './FloatingGarments.jsx';

/**
 * Full-screen surface covering the whole AI try-on lifecycle: waiting, the
 * result, and failure.
 *
 * One component rather than three because they are the same surface at
 * different moments — splitting them meant unmounting and remounting a
 * full-screen layer mid-flow, which flashes.
 */

/**
 * Staged reassurance while the model runs. Timed to the shape of a real request
 * rather than a fixed countdown: a warm run finishes in single-digit seconds, a
 * cold start takes half a minute, and we cannot tell which we are in until it
 * returns. A countdown that hits zero and keeps going looks broken; elapsed time
 * that keeps moving does not.
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

  return (
    <div className="absolute inset-0 z-40 flex flex-col overflow-hidden bg-ground text-neutral-900">
      <FloatingGarments garments={garments} exclude={garment.id} density="light" />

      {status === 'processing' && (
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-8 text-center">
          {/* The garment itself is the loading indicator. It is what the shopper
              is waiting for, and it beats a neutral spinner at saying so. */}
          <div className="relative flex size-40 items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-brand/10 blur-2xl" />
            <img
              src={garment.thumb}
              alt=""
              className="relative size-32 animate-[drift_3s_ease-in-out_infinite] object-contain drop-shadow-2xl"
            />
          </div>

          <p className="mt-8 text-[17px] font-semibold tracking-tight">{stageFor(elapsed)}</p>

          {/*
            An indeterminate bar, not a percentage. We genuinely do not know how
            long this takes — a warm model finishes in seconds, a cold start takes
            half a minute — and a fake percentage that stalls at 90% is worse than
            one that never claimed to know.
          */}
          <div className="mt-5 h-1 w-56 overflow-hidden rounded-full bg-black/5">
            <div className="h-full w-1/3 animate-[indeterminate_1.6s_ease-in-out_infinite] rounded-full bg-brand" />
          </div>
          <p className="mt-3 font-mono text-xs tabular-nums text-neutral-400">
            {elapsed.toFixed(1)}s
          </p>

          <button
            type="button"
            onClick={onCancel}
            className="mt-9 rounded-full bg-white px-5 py-2.5 text-[13px] font-medium text-neutral-600 shadow-sm ring-1 ring-black/5 transition hover:text-neutral-900"
          >
            Cancel
          </button>
        </div>
      )}

      {status === 'error' && (
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-8 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-rose-50 text-2xl text-rose-500 ring-1 ring-rose-100">
            !
          </div>
          <h2 className="mt-5 text-xl font-semibold tracking-tight">Try-on failed</h2>
          <p className="mt-2.5 max-w-sm text-[13px] leading-relaxed text-neutral-500">
            {error?.message}
          </p>
          {error?.code && (
            <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-neutral-300">
              {error.code}
            </p>
          )}

          <button
            type="button"
            onClick={onRetry}
            className="group mt-8 flex w-full max-w-xs items-center justify-between gap-3 rounded-full bg-white py-2 pl-6 pr-2 text-left shadow-lg shadow-black/[0.07] ring-1 ring-black/5 transition active:scale-[0.99]"
          >
            <span className="text-[15px] font-medium text-neutral-700">Try again</span>
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand text-white transition group-hover:bg-brand-dark">
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M5 12h13M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </button>
          <button
            type="button"
            onClick={onRetake}
            className="mt-3.5 text-[13px] font-medium text-neutral-500 underline underline-offset-4 transition hover:text-neutral-800"
          >
            Retake photo
          </button>
        </div>
      )}

      {status === 'done' && result && (
        <>
          <header className="relative z-10 flex items-start justify-between gap-3 px-6 pb-3 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
            <div className="min-w-0">
              <span className="inline-block rounded-full bg-brand/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-brand">
                {showBefore ? 'Your photo' : 'AI try-on'}
              </span>
              <h2 className="mt-2 truncate text-lg font-semibold tracking-tight">{garment.name}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-lg leading-none text-neutral-500 shadow-sm ring-1 ring-black/5 transition hover:text-neutral-900"
            >
              ×
            </button>
          </header>

          <div className="relative z-10 flex flex-1 items-center justify-center overflow-hidden px-6">
            <div className="relative animate-[reveal_.5s_ease-out] rounded-3xl bg-white p-2.5 shadow-2xl shadow-black/10 ring-1 ring-black/5">
              <img
                src={showBefore ? captured : result.image}
                alt={showBefore ? 'The photo you captured' : `AI try-on of ${garment.name}`}
                className="max-h-[54vh] w-auto rounded-2xl object-contain"
              />
              {captured && (
                <button
                  type="button"
                  onClick={() => setShowBefore((v) => !v)}
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-neutral-900/80 px-4 py-2 text-xs font-medium text-white backdrop-blur transition hover:bg-neutral-900"
                >
                  {showBefore ? 'Show result' : 'Compare'}
                </button>
              )}
            </div>
          </div>

          <footer className="relative z-10 px-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-5">
            <button
              type="button"
              onClick={async () => {
                setSaveState('saving');
                const how = await saveImage(result.image, `tryon-${garment.id.toLowerCase()}.png`);
                setSaveState(how);
                setTimeout(() => setSaveState('idle'), 2500);
              }}
              className="group flex w-full items-center justify-between gap-3 rounded-full bg-white py-2 pl-6 pr-2 text-left shadow-lg shadow-black/[0.07] ring-1 ring-black/5 transition active:scale-[0.99]"
            >
              <span className="text-[15px] font-medium text-neutral-700">
                {saveState === 'saving'
                  ? 'Saving…'
                  : saveState === 'saved'
                    ? 'Saved to your phone'
                    : saveState === 'opened'
                      ? 'Opened — long-press to save'
                      : 'Save photo to phone'}
              </span>
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand text-white transition group-hover:bg-brand-dark">
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M12 4v12m0 0l-5-5m5 5l5-5M4 20h16" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </button>

            <div className="mt-4 flex items-center justify-center gap-5 text-[13px] font-medium text-neutral-500">
              <button
                type="button"
                onClick={onClose}
                className="underline underline-offset-4 transition hover:text-neutral-800"
              >
                Try another garment
              </button>
              <span className="text-neutral-300">·</span>
              <button
                type="button"
                onClick={onRetake}
                className="underline underline-offset-4 transition hover:text-neutral-800"
              >
                Retake photo
              </button>
            </div>

            {result.ms && (
              <p className="mt-4 text-center text-[10px] text-neutral-400">
                Generated in {(result.ms / 1000).toFixed(1)}s
              </p>
            )}
          </footer>
        </>
      )}
    </div>
  );
}
