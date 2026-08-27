import { useEffect, useRef } from 'react';

/**
 * The flowing ribbon shown while the model runs.
 *
 * It is a real twisted band rather than a stack of offset sine waves, which is
 * what gives it the pinch in the middle. Each strand sits at an offset `u`
 * across the band's width; the band rotates about its own long axis by an angle
 * that increases along its length, so a strand's on-screen height is
 * `u * cos(phi)`. Where phi passes a quarter turn the whole band is edge-on and
 * every strand collapses onto the centreline — the crossover point. Offset sine
 * waves never produce that; they just slide past each other.
 *
 * Animating the phase makes the twist travel along the ribbon, so the motion
 * reads as one continuous surface moving rather than separate lines wiggling.
 *
 * Canvas rather than SVG: this draws ~3000 points per frame, and that many DOM
 * nodes being restyled every frame is exactly what SVG is bad at. Nothing else
 * is competing for the CPU here — the phone is waiting on a network request.
 */

/** Strands across the band. Enough to read as a surface, few enough to stay crisp. */
const STRANDS = 38;

/** Samples along each strand. Below ~60 the crossover point visibly facets. */
const STEPS = 96;

/**
 * If the animation's own draw cost averages above this, it switches itself off.
 *
 * Measured at 0.19ms/frame on a desktop — about 1% of a 60fps budget — but this
 * runs on whatever phone walks into the shop, and a decoration must never be the
 * reason a try-on feels slow. 6ms is roughly a third of the frame budget: far
 * above anything healthy, low enough to catch a device where this is genuinely
 * expensive before a person notices. Once tripped it stays off and the last
 * frame remains as a still image.
 */
const FRAME_BUDGET_MS = 6;

/** Frames averaged before judging. One slow frame during a GC pause is noise. */
const WATCHDOG_WINDOW = 45;

export default function FlowRibbon({ className = '' }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Honour the OS setting: this is ambient decoration, and continuous motion
    // is the kind people switch off for real reasons.
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    // Cap DPR at 2. Beyond that the extra pixels are invisible and the fill rate
    // is not free on a mid-range phone.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let raf = 0;
    let phase = 0;
    let costSum = 0;
    let costCount = 0;
    let disabled = false;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
    };

    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      if (!W || !H) return;

      const drawStart = performance.now();
      ctx.clearRect(0, 0, W, H);

      const midY = H / 2;
      const bandHalf = H * 0.34;

      for (let s = 0; s < STRANDS; s++) {
        // -1 .. 1 across the width of the band
        const u = (s / (STRANDS - 1)) * 2 - 1;

        ctx.beginPath();
        for (let i = 0; i <= STEPS; i++) {
          const x = i / STEPS;

          // The twist. Slightly more than half a turn across the length, so one
          // clear crossover sits on screen with the ends opening out either side.
          const phi = Math.PI * (x * 1.55) + phase;

          // Taper. Without it the band ends in two hard vertical edges; the
          // reference fades to nothing at both tips.
          const envelope = Math.sin(Math.PI * x) ** 0.75;

          // A slow drift of the centreline, so the whole ribbon breathes rather
          // than spinning in place.
          const centre = Math.sin(x * Math.PI * 1.1 + phase * 0.55) * H * 0.07;

          const y = midY + centre + envelope * u * bandHalf * Math.cos(phi);
          const px = x * W;
          if (i === 0) ctx.moveTo(px, y);
          else ctx.lineTo(px, y);
        }

        // Strands at the band's edges fade out; the dense middle carries the
        // weight. Overlapping strokes compound naturally, which is what produces
        // the bright seam through the centre without drawing it explicitly.
        const edgeFade = 1 - Math.abs(u) ** 2.1;
        ctx.strokeStyle = `rgba(17, 17, 17, ${0.05 + edgeFade * 0.45})`;
        ctx.lineWidth = dpr * 0.85;
        ctx.stroke();
      }

      // Self-policing: if this turns out to be expensive on the device actually
      // running it, stop rather than compete with the work the shopper is
      // waiting for. The drawn frame stays on screen as a still.
      costSum += performance.now() - drawStart;
      costCount += 1;
      if (costCount >= WATCHDOG_WINDOW) {
        if (costSum / costCount > FRAME_BUDGET_MS) disabled = true;
        costSum = 0;
        costCount = 0;
      }

      if (!reduced && !disabled) {
        phase += 0.016;
        raf = requestAnimationFrame(draw);
      }
    };

    resize();
    draw();

    const observer = new ResizeObserver(() => {
      resize();
      if (reduced) draw();
    });
    observer.observe(canvas);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden className={className} />;
}
