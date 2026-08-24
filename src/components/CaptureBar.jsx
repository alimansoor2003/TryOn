import { useRef } from 'react';

/**
 * Shutter plus gallery fallback.
 *
 * The shutter fires on click and only on click. There is no timer, no
 * countdown, no burst, and no capture triggered by pose, focus or any other
 * signal — the shopper presses the button or no photo is taken. The gallery
 * input is a plain `<input type="file">`, which on a phone offers the camera
 * roll (and the system camera, under the OS's own permission UI) without this
 * app ever reaching for either on its own.
 */
export default function CaptureBar({ onCapture, onFile, disabled, busy, garmentName }) {
  const fileRef = useRef(null);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex w-full items-center justify-center gap-6">
        <div className="flex w-24 justify-end">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-white/70 transition hover:bg-white/10 disabled:opacity-40"
          >
            <svg viewBox="0 0 24 24" aria-hidden className="size-6" fill="none" stroke="currentColor" strokeWidth="1.7">
              <rect x="3" y="5" width="18" height="14" rx="2.5" />
              <circle cx="8.5" cy="10" r="1.6" />
              <path d="M21 16l-5-5-6.5 8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-[10px] font-medium leading-none">Upload</span>
          </button>
          {/*
            `accept="image/*"` with no `capture` attribute on purpose. Adding
            capture="user" would force the OS camera and defeat the point of
            offering an existing photo.
          */}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              // Reset first so choosing the same file twice still fires change.
              e.target.value = '';
              if (file) onFile(file);
            }}
          />
        </div>

        <button
          type="button"
          onClick={onCapture}
          disabled={disabled}
          aria-label="Take photo"
          className="group flex size-[72px] items-center justify-center rounded-full border-4 border-white/85 transition active:scale-95 disabled:border-white/25"
        >
          <span className="size-[54px] rounded-full bg-white transition group-active:bg-white/80 group-disabled:bg-white/25" />
        </button>

        <div className="w-24" />
      </div>

      <p className="px-6 text-center text-[11px] leading-tight text-white/40">
        {busy
          ? 'Working…'
          : disabled
            ? 'Waiting for the camera'
            : `Take a photo to try on the ${garmentName}`}
      </p>
    </div>
  );
}
