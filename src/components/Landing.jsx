import { useRef } from 'react';
import FloatingGarments from './FloatingGarments.jsx';

/**
 * The screen a QR scan lands on. Phone-first: this is reached by scanning a code
 * in a shop, so the 375px column is the design and the desktop view is that same
 * column centred, not a separate layout.
 *
 * Follows Google's Try-it-on screen rather than a general storefront, because it
 * is solving the same problem — one garment, one action, and a shopper who has
 * to be told what makes a usable photo *before* they take one. A shopfront grid
 * would be the wrong shape: there is nothing to browse here.
 */

/**
 * The requirements list is the highest-value part of this screen.
 *
 * IDM-VTON fails in specific, predictable ways — it needs a full body, one
 * person, and clothes it can find edges on. Every one of these prevents a
 * failure that otherwise costs the shopper a 30-second wait and returns
 * something distorted, which they will read as the app being bad rather than the
 * photo being wrong. Cheaper to say up front than to explain afterwards.
 */
const REQUIREMENTS = [
  'Full body',
  'Good lighting',
  'Just you',
  'Face the camera',
  'Fitted clothes',
];

function Check() {
  return (
    <svg viewBox="0 0 20 20" className="size-[15px] shrink-0 text-neutral-400" aria-hidden>
      <circle cx="10" cy="10" r="8.25" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M6.4 10.2l2.4 2.4 4.6-4.9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Landing({ garment, garments, matched, onSelect, onTakePhoto, onFile }) {
  const fileRef = useRef(null);

  // Flankers are the items the shopper did NOT scan, so the scanned garment
  // reads as the subject rather than as one of three equals.
  const others = garments.filter((g) => g.id !== garment.id);
  const [left, right] = [others[0] ?? garment, others[1] ?? others[0] ?? garment];

  return (
    <div className="absolute inset-0 overflow-y-auto overflow-x-hidden bg-white text-neutral-900">
      {/* Desktop only. On a phone the column fills the screen and there is no
          margin for anything to drift in. */}
      <div className="pointer-events-none absolute inset-0 hidden lg:block">
        <FloatingGarments garments={garments} exclude={garment.id} density="medium" />
      </div>

      <div className="relative mx-auto flex min-h-full w-full max-w-[440px] flex-col px-6 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-[calc(env(safe-area-inset-top)+1rem)]">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1.5 text-[11px] font-medium text-neutral-600">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            {matched ? 'Scanned in store' : 'Featured item'}
          </span>
        </div>

        <h1 className="mt-4 text-[54px] font-bold leading-[0.92] tracking-[-0.035em]">
          Try
          <br />
          it on
        </h1>

        {/*
          Hero band. The scanned garment sits centre and full height; the two
          flankers are deliberately cropped by the container so the row reads as
          a wider rail continuing past the screen, the way the reference does.
        */}
        <div className="relative mt-5 flex h-[208px] items-end justify-center gap-2">
          <img
            src={left.thumb}
            alt=""
            className="h-[62%] w-auto -translate-x-2 animate-[drift_11s_ease-in-out_infinite] object-contain opacity-90 drop-shadow-xl"
          />
          <img
            src={garment.thumb}
            alt={garment.name}
            className="h-full w-auto animate-[drift_9s_ease-in-out_infinite] object-contain drop-shadow-2xl"
            style={{ animationDelay: '.6s' }}
          />
          <img
            src={right.thumb}
            alt=""
            className="h-[62%] w-auto translate-x-2 animate-[drift_13s_ease-in-out_infinite] object-contain opacity-90 drop-shadow-xl"
            style={{ animationDelay: '1.3s' }}
          />
        </div>

        <p className="mt-2 text-center text-[13px]">
          <span className="font-semibold">{garment.name}</span>
          <span className="text-neutral-400"> · {garment.subtitle}</span>
        </p>

        {garments.length > 1 && (
          <div className="mt-3 flex justify-center gap-2">
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

        <h2 className="mt-6 text-center text-[15px] font-semibold">Photo requirements:</h2>
        <ul className="mx-auto mt-3 flex max-w-[340px] flex-wrap justify-center gap-x-4 gap-y-2">
          {REQUIREMENTS.map((r) => (
            <li key={r} className="flex items-center gap-1.5 text-[12px] text-neutral-600">
              <Check />
              {r}
            </li>
          ))}
        </ul>

        <div className="mt-auto pt-6">
          <button
            type="button"
            onClick={onTakePhoto}
            className="flex w-full items-center justify-center gap-2.5 rounded-full bg-neutral-900 py-4 text-[15px] font-medium text-white transition active:scale-[0.99] hover:bg-neutral-800"
          >
            <svg viewBox="0 0 24 24" className="size-[19px]" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path
                d="M3 8.5A1.5 1.5 0 014.5 7h2.2l1.2-2h8.2l1.2 2h2.2A1.5 1.5 0 0121 8.5v9a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 17.5z"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="13" r="3.4" />
            </svg>
            Take a photo
          </button>

          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="mt-3 w-full rounded-full border border-neutral-200 py-3.5 text-[15px] font-medium text-neutral-700 transition hover:bg-neutral-50"
          >
            Upload photo
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

          {/*
            Not boilerplate. This screen asks a stranger in a shop to photograph
            their own body and send it to a generative model — saying plainly
            whose photo to upload, that the output can be wrong, and that nothing
            is kept is the minimum owed to them before they press the button.
          */}
          <p className="mt-4 text-center text-[10px] leading-relaxed text-neutral-400">
            Only upload a photo of yourself. Generative AI is experimental and can
            make mistakes. Your photo is sent once to create the try-on and is not
            stored or recorded.
          </p>
        </div>
      </div>
    </div>
  );
}
