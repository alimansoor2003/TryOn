/**
 * Static framing guide over the live camera.
 *
 * Replaces the pose-tracked overlay. Nothing here reads the video — it is one
 * inline SVG and a caption, so the viewfinder costs a `<video>` element and
 * nothing else. That is the point of the refactor: no per-frame inference, no
 * canvas loop, no WASM download before the camera is usable.
 *
 * The shape is deliberately vague. A precise outline invites people to line
 * themselves up to the pixel, and IDM-VTON does not need that — it needs a
 * head-to-thigh view of one person. An approximate guide communicates framing
 * without implying a precision the model never asked for.
 */
export default function SilhouetteGuide({ hint = 'Position yourself inside the frame' }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
      <svg
        viewBox="0 0 200 400"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
        className="h-[78%] max-h-[560px] w-auto opacity-45"
      >
        <defs>
          {/* Fades the guide out at the bottom so it reads as a suggestion
              rather than a box the shopper has to stand inside. */}
          <linearGradient id="guideFade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="white" stopOpacity="0.95" />
            <stop offset="70%" stopColor="white" stopOpacity="0.55" />
            <stop offset="100%" stopColor="white" stopOpacity="0.05" />
          </linearGradient>
        </defs>

        <g
          fill="none"
          stroke="url(#guideFade)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="7 7"
        >
          <circle cx="100" cy="52" r="30" />
          <path d="M100 84 v18" />
          <path d="M60 128 C 72 108, 128 108, 140 128" />
          <path d="M60 128 C 52 190, 54 260, 58 330" />
          <path d="M140 128 C 148 190, 146 260, 142 330" />
          <path d="M100 150 v180" />
        </g>
      </svg>

      <p className="absolute bottom-[14%] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/50 px-4 py-2 text-xs font-medium text-white/85 backdrop-blur-sm">
        {hint}
      </p>
    </div>
  );
}
