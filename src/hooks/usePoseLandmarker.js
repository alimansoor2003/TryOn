import { useEffect, useRef, useState } from 'react';
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import { MODEL_URL, WASM_BASE } from '../lib/mediapipeAssets.js';

/**
 * Loads the MediaPipe pose model once and hands back a ref to it.
 *
 * The detection call itself is NOT here — it belongs inside the render loop so
 * detect-and-draw happen on the same frame. Running them on separate schedules
 * makes the garment trail the body by a frame, which reads as lag.
 *
 * Uses the Tasks Vision API rather than the legacy `@mediapipe/pose` package:
 * identical 33-point topology and landmark indices, but it ships as real ESM
 * (the legacy build fights Vite's bundler), and it exposes the GPU delegate
 * that gets us over the 24fps bar on mid-range phones.
 */
export function usePoseLandmarker({ enabled = true } = {}) {
  const landmarkerRef = useRef(null);
  const [status, setStatus] = useState('idle'); // idle | loading | ready | error
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let created = null;

    (async () => {
      setStatus('loading');
      try {
        const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);

        // GPU is worth roughly 2x here, but WebGL is unavailable on some
        // locked-down browsers and inside certain in-app webviews, so fall
        // back rather than showing a dead screen.
        try {
          created = await PoseLandmarker.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
            runningMode: 'VIDEO',
            numPoses: 1,
            minPoseDetectionConfidence: 0.5,
            minPosePresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
            outputSegmentationMasks: false,
          });
        } catch {
          created = await PoseLandmarker.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
            runningMode: 'VIDEO',
            numPoses: 1,
            outputSegmentationMasks: false,
          });
        }

        if (cancelled) {
          created.close();
          return;
        }
        landmarkerRef.current = created;
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        setError(
          `Pose model failed to load. ${err?.message ?? ''} If this store's network blocks the CDN, run "npm run vendor:model" and set VITE_MODEL_BASE=/mediapipe.`,
        );
        setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
    };
  }, [enabled]);

  return { landmarkerRef, status, error };
}
