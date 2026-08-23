import { useState } from 'react';

/**
 * Live calibration for the four numbers in a garment's `fit` block.
 *
 * This exists because those numbers are properties of the artwork, not of the
 * code — every time real product photography replaces a placeholder, they have
 * to be re-derived. Doing that by editing a file and reloading on a phone is
 * miserable; doing it with sliders while watching yourself takes about a
 * minute per suit. "Copy fit block" emits exactly what to paste back into
 * src/data/garments.js so the tuned values survive a reload.
 */

const CONTROLS = [
  {
    key: 'widthFactor',
    label: 'Width',
    min: 0.9,
    max: 2,
    step: 0.01,
    hint: 'Garment shoulder width ÷ your shoulder width',
  },
  {
    key: 'offsetY',
    label: 'Vertical',
    min: -0.4,
    max: 0.4,
    step: 0.005,
    hint: 'Slide along the torso, in shoulder widths',
  },
  {
    key: 'span',
    label: 'Body span',
    min: 0.3,
    max: 0.95,
    step: 0.005,
    hint: 'How much of the image width sits between the anchor joints',
  },
  {
    key: 'anchorY',
    label: 'Anchor',
    min: 0,
    max: 0.6,
    step: 0.005,
    hint: 'Where the shoulder line sits inside the image',
  },
];

export default function FitTuner({ garment, fit, onChange, opacity, onOpacityChange, showSkeleton, onSkeletonChange, onReset }) {
  const [copied, setCopied] = useState(false);

  const value = (key) => (key === 'anchorY' ? fit.anchor.y : fit[key]);

  const set = (key, next) => {
    onChange(
      key === 'anchorY'
        ? { ...fit, anchor: { ...fit.anchor, y: next } }
        : { ...fit, [key]: next },
    );
  };

  const copyBlock = async () => {
    const block = `fit: {
  src: '${garment.fit.src}',
  region: '${fit.region ?? 'upper'}',
  anchor: { x: ${fit.anchor.x}, y: ${Number(fit.anchor.y.toFixed(3))} },
  span: ${Number(fit.span.toFixed(3))},
  widthFactor: ${Number(fit.widthFactor.toFixed(3))},
  offsetY: ${Number(fit.offsetY.toFixed(3))},
},`;
    try {
      await navigator.clipboard.writeText(block);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard is blocked in some in-app webviews; log so the values are
      // still recoverable from a remote-inspect session.
      console.info('[FitTuner] copy blocked, fit block follows:\n' + block);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <section className="rounded-2xl border border-white/12 bg-black/70 p-4 backdrop-blur-md">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-white/50">
          Fit calibration — {garment.id} · {fit.region ?? 'upper'} body
        </h2>
        <button
          type="button"
          onClick={onReset}
          className="text-[11px] text-white/45 underline underline-offset-2 hover:text-white/80"
        >
          Reset
        </button>
      </div>

      <div className="space-y-3">
        {CONTROLS.map((c) => (
          <label key={c.key} className="block">
            <span className="mb-1 flex items-baseline justify-between">
              <span className="text-[13px] text-white/85">{c.label}</span>
              <span className="font-mono text-[11px] tabular-nums text-white/50">
                {value(c.key).toFixed(3)}
              </span>
            </span>
            <input
              type="range"
              min={c.min}
              max={c.max}
              step={c.step}
              value={value(c.key)}
              onChange={(e) => set(c.key, Number(e.target.value))}
              className="w-full accent-white"
              aria-describedby={`hint-${c.key}`}
            />
            <span id={`hint-${c.key}`} className="mt-0.5 block text-[10px] leading-tight text-white/35">
              {c.hint}
            </span>
          </label>
        ))}

        <label className="block">
          <span className="mb-1 flex items-baseline justify-between">
            <span className="text-[13px] text-white/85">Opacity</span>
            <span className="font-mono text-[11px] tabular-nums text-white/50">
              {opacity.toFixed(2)}
            </span>
          </span>
          <input
            type="range"
            min={0.2}
            max={1}
            step={0.01}
            value={opacity}
            onChange={(e) => onOpacityChange(Number(e.target.value))}
            className="w-full accent-white"
          />
          <span className="mt-0.5 block text-[10px] leading-tight text-white/35">
            Drop below 1 to see how the garment lines up against your body
          </span>
        </label>

        <label className="flex items-center gap-2.5 pt-1">
          <input
            type="checkbox"
            checked={showSkeleton}
            onChange={(e) => onSkeletonChange(e.target.checked)}
            className="size-4 accent-emerald-400"
          />
          <span className="text-[13px] text-white/85">Show pose landmarks</span>
        </label>
      </div>

      <button
        type="button"
        onClick={copyBlock}
        className="mt-4 w-full rounded-xl bg-white px-4 py-2.5 text-[13px] font-semibold text-black transition active:scale-[0.99]"
      >
        {copied ? 'Copied — paste into garments.js' : 'Copy fit block'}
      </button>
    </section>
  );
}
