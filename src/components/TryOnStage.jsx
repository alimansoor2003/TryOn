import { useEffect, useRef } from 'react';
import { computeGarmentTransform, drawGarment } from '../lib/fit.js';
import { coverProjection, prepareCanvas } from '../lib/viewport.js';
import { SKELETON_EDGES } from '../lib/landmarks.js';
import { LandmarkSmoother } from '../lib/smoothing.js';

/** Frames without a pose before we tell the shopper to reposition. */
const LOST_AFTER_FRAMES = 12;

/**
 * Frames excluded from the FPS average at startup. The first inference pays for
 * WASM JIT and GPU shader compilation and takes roughly half a second; folding
 * that into the average pins the badge to a red single-digit number for the
 * first few seconds of every session, which is exactly when someone is deciding
 * whether the demo is any good.
 */
const FPS_WARMUP_FRAMES = 5;

function drawSkeleton(ctx, landmarks, project) {
  ctx.save();
  ctx.strokeStyle = 'rgba(80, 227, 194, 0.9)';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (const [a, b] of SKELETON_EDGES) {
    const pa = landmarks[a];
    const pb = landmarks[b];
    if (!pa || !pb) continue;
    const p1 = project(pa);
    const p2 = project(pb);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  for (const lm of landmarks) {
    const p = project(lm);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * The viewfinder: live camera underneath, garment overlay stamped on top.
 *
 * Detection and drawing share one requestAnimationFrame tick on purpose. If
 * pose ran on its own timer the garment would always render against a pose from
 * the previous frame, and that one-frame offset is exactly what people describe
 * as "the jacket lags behind me".
 */
export default function TryOnStage({
  videoRef,
  landmarkerRef,
  garmentAsset,
  fit,
  mirrored,
  showSkeleton,
  opacity = 1,
  onStats,
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  // Loop-local mutable state kept in refs so changing props never restarts the
  // rAF loop — tearing down and rebuilding it mid-session drops frames.
  const assetRef = useRef(garmentAsset);
  const fitRef = useRef(fit);
  const skeletonRef = useRef(showSkeleton);
  const opacityRef = useRef(opacity);
  const statsRef = useRef(onStats);

  assetRef.current = garmentAsset;
  fitRef.current = fit;
  skeletonRef.current = showSkeleton;
  opacityRef.current = opacity;
  statsRef.current = onStats;

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!video || !canvas || !container) return;

    const smoother = new LandmarkSmoother();
    let rafId = 0;
    let lastVideoTime = -1;
    let lastTimestamp = 0;
    let lostFrames = 0;
    let tracking = false;
    let fps = 0;
    let framesSeen = 0;
    let lastFrameAt = 0;
    let lastReportAt = 0;

    const box = { width: container.clientWidth, height: container.clientHeight };
    const resizeObserver = new ResizeObserver(([entry]) => {
      box.width = entry.contentRect.width;
      box.height = entry.contentRect.height;
    });
    resizeObserver.observe(container);

    const tick = () => {
      rafId = requestAnimationFrame(tick);

      const landmarker = landmarkerRef.current;
      if (!landmarker || video.readyState < 2 || !video.videoWidth) return;

      // No new camera frame yet. Bail without clearing so the previous overlay
      // stays put rather than strobing.
      if (video.currentTime === lastVideoTime) return;
      lastVideoTime = video.currentTime;

      const now = performance.now();
      framesSeen += 1;
      if (lastFrameAt && framesSeen > FPS_WARMUP_FRAMES) {
        const instant = 1000 / Math.max(now - lastFrameAt, 1);
        fps = fps ? fps * 0.9 + instant * 0.1 : instant;
      }
      lastFrameAt = now;

      // detectForVideo rejects non-increasing timestamps outright.
      const timestamp = now <= lastTimestamp ? lastTimestamp + 1 : now;
      lastTimestamp = timestamp;

      let result;
      try {
        result = landmarker.detectForVideo(video, timestamp);
      } catch {
        // A transient WASM hiccup (usually the tab regaining focus). Skip the
        // frame; the next one almost always succeeds.
        return;
      }

      const ctx = prepareCanvas(canvas, box);
      const project = coverProjection(video, box);
      const raw = result?.landmarks?.[0];

      if (raw?.length) {
        lostFrames = 0;
        const landmarks = smoother.apply(raw, timestamp);

        if (skeletonRef.current) drawSkeleton(ctx, landmarks, project);

        const asset = assetRef.current;
        if (asset) {
          const transform = computeGarmentTransform(landmarks, project, fitRef.current, asset.size);
          if (transform) {
            drawGarment(ctx, asset.image, transform, opacityRef.current);
            if (!tracking) {
              tracking = true;
              statsRef.current?.({ tracking: true });
            }
          }
        }
      } else {
        lostFrames += 1;
        if (lostFrames === LOST_AFTER_FRAMES) {
          smoother.reset();
          tracking = false;
          statsRef.current?.({ tracking: false });
        }
      }

      // `fps` stays 0 through warmup; the badge renders that as "--" rather
      // than a number nobody should be reading yet.
      if (now - lastReportAt > 500) {
        lastReportAt = now;
        statsRef.current?.({ fps: Math.round(fps) });
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
    };
  }, [videoRef, landmarkerRef]);

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden bg-black">
      <div
        className="absolute inset-0"
        style={{ transform: mirrored ? 'scaleX(-1)' : 'none' }}
      >
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          playsInline
          muted
          autoPlay
        />
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      </div>
    </div>
  );
}
