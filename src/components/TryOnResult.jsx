import { useEffect, useState } from 'react';

/**
 * Full-screen overlay covering the whole AI try-on lifecycle: waiting, the
 * result, and failure.
 *
 * One component rather than three because they are the same surface at
 * different moments — splitting them meant unmounting and remounting a
 * full-screen layer mid-flow, which flashes.
 */

/**
 * Staged reassurance while the model runs. These are timed to the shape of a
 * real request rather than a fixed countdown: a warm IDM-VTON run finishes in
 * single-digit seconds, a cold start can take half a minute, and we cannot tell
 * which we are in until it returns. A countdown that hits zero and keeps going
 * looks broken; elapsed time that keeps moving does not.
 */
const STAGES = [
  { after: 0, text: 'Sending your photo…' },
  { after: 3, text: 'Tailoring your garment with AI…' },
  { after: 10, text: 'Fitting it to your body…' },
  { after: 20, text: 'Rendering fabric and shadows…' },
  { after: 35, text: 'Almost there — cold starts take a little longer.' },
];

function stageFor(seconds) {
  let current = STAGES[0].text;
  for (const s of STAGES) if (seconds >= s.after) current = s.text;
  return current;
}

function Spinner() {
  return (
    <span className="relative flex size-14">
      <span className="absolute inset-0 rounded-full border-2 border-white/15" />
      <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-white" />
    </span>
  );
}

/**
 * Saving the result.
 *
 * Fetching it into a blob first is what makes the filename stick and keeps the
 * save working after Replicate's delivery URL expires. That fetch is
 * cross-origin, so it can be refused; when it is, opening the image in a new tab
 * still lets the shopper save it by long-press, which is how people save images
 * on a phone anyway.
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
    // Revoke on the next tick; revoking synchronously races the download start
    // in some browsers and silently produces a zero-byte file.
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

  const busy = status === 'capturing' || status === 'processing';

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-neutral-950/95 backdrop-blur-sm">
      {busy && (
        <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
          <Spinner />
          <p className="mt-6 text-[15px] font-medium text-white">{stageFor(elapsed)}</p>

          {/*
            An indeterminate bar, not a percentage. We genuinely do not know how
            long this takes — a warm model finishes in seconds, a cold start
            takes half a minute — and a fake percentage that stalls at 90% is
            worse than one that never claimed to know.
          */}
          <div className="mt-5 h-1 w-56 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-1/3 animate-[indeterminate_1.6s_ease-in-out_infinite] rounded-full bg-white/70" />
          </div>
          <p className="mt-3 font-mono text-xs tabular-nums text-white/40">
            {elapsed.toFixed(1)}s
          </p>
          <p className="mt-6 max-w-xs text-xs leading-relaxed text-white/40">
            Generating a photorealistic try-on of the {garment.name.toLowerCase()}. The first run
            after a quiet spell is the slowest.
          </p>
          <button
            type="button"
            onClick={onCancel}
            className="mt-8 rounded-full border border-white/20 px-5 py-2 text-xs font-medium text-white/70 transition hover:bg-white/10"
          >
            Cancel
          </button>
        </div>
      )}

      {status === 'error' && (
        <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-rose-500/15 text-xl text-rose-300">
            !
          </div>
          <h2 className="mt-5 text-base font-semibold text-white">Try-on failed</h2>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/60">{error?.message}</p>
          {error?.code && (
            <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-white/25">
              {error.code}
            </p>
          )}
          <div className="mt-8 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/20 px-5 py-2.5 text-sm text-white/80 transition hover:bg-white/10"
            >
              Back
            </button>
            <button
              type="button"
              onClick={onRetry}
              className="rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-black transition active:scale-[0.98]"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {status === 'done' && result && (
        <>
          <header className="flex items-center justify-between px-4 pb-2 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-white">{garment.name}</h2>
              <p className="text-[11px] text-white/45">
                {showBefore ? 'Your photo' : 'AI try-on'}
                {result.ms ? ` · ${(result.ms / 1000).toFixed(1)}s` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex size-9 items-center justify-center rounded-full bg-white/10 text-lg leading-none text-white/80 transition hover:bg-white/20"
            >
              ×
            </button>
          </header>

          <div className="relative flex flex-1 items-center justify-center overflow-hidden px-4">
            <img
              src={showBefore ? captured : result.image}
              alt={showBefore ? 'The photo you captured' : `AI try-on of ${garment.name}`}
              className="max-h-full max-w-full rounded-2xl object-contain shadow-2xl"
            />
            {captured && (
              <button
                type="button"
                onClick={() => setShowBefore((v) => !v)}
                className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/65 px-4 py-2 text-xs font-medium text-white backdrop-blur transition hover:bg-black/80"
              >
                {showBefore ? 'Show result' : 'Compare with original'}
              </button>
            )}
          </div>

          <footer className="px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4">
            <div className="mb-3 flex gap-3">
              <button
                type="button"
                onClick={onRetake}
                className="flex-1 rounded-full border border-white/20 py-3 text-sm font-medium text-white/85 transition hover:bg-white/10"
              >
                Retake photo
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-full border border-white/20 py-3 text-sm font-medium text-white/85 transition hover:bg-white/10"
              >
                Try another garment
              </button>
            </div>
            <button
              type="button"
              onClick={async () => {
                setSaveState('saving');
                const how = await saveImage(result.image, `tryon-${garment.id.toLowerCase()}.png`);
                setSaveState(how);
                setTimeout(() => setSaveState('idle'), 2500);
              }}
              className="w-full rounded-full bg-white py-3.5 text-sm font-semibold text-black transition active:scale-[0.98]"
            >
              {saveState === 'saving'
                ? 'Saving…'
                : saveState === 'saved'
                  ? 'Saved'
                  : saveState === 'opened'
                    ? 'Opened — long-press to save'
                    : 'Save photo to phone'}
            </button>
          </footer>
        </>
      )}
    </div>
  );
}
