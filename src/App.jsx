import { useCallback, useEffect, useMemo, useState } from 'react';
import TryOnStage from './components/TryOnStage.jsx';
import TopBar from './components/TopBar.jsx';
import GarmentCarousel from './components/GarmentCarousel.jsx';
import FitTuner from './components/FitTuner.jsx';
import TryOnResult from './components/TryOnResult.jsx';
import StatusLayer from './components/StatusLayer.jsx';
import { useCamera } from './hooks/useCamera.js';
import { usePoseLandmarker } from './hooks/usePoseLandmarker.js';
import { useGarmentImages } from './hooks/useGarmentImages.js';
import { useTryOn } from './hooks/useTryOn.js';
import { GARMENTS, resolveGarment } from './data/garments.js';

/** Reads ?item_id=SUIT_01 off the QR-code URL. */
function itemIdFromUrl() {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('item_id');
}

export default function App() {
  const [{ garment: initial, matched }] = useState(() => resolveGarment(itemIdFromUrl()));
  const [activeId, setActiveId] = useState(initial.id);

  // Tuned fit values live here rather than in the garment data so the sliders
  // can move without mutating the shared catalogue.
  const [fits, setFits] = useState(() =>
    Object.fromEntries(GARMENTS.map((g) => [g.id, { ...g.fit, anchor: { ...g.fit.anchor } }])),
  );
  const [opacity, setOpacity] = useState(1);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [tuning, setTuning] = useState(false);
  const [stats, setStats] = useState({ fps: 0, tracking: false });

  const camera = useCamera({ autoStart: true });
  const model = usePoseLandmarker({ enabled: true });
  const { images, failed } = useGarmentImages(GARMENTS);
  const tryOn = useTryOn();

  const garment = useMemo(
    () => GARMENTS.find((g) => g.id === activeId) ?? GARMENTS[0],
    [activeId],
  );
  const fit = fits[garment.id];
  const asset = images.get(garment.id) ?? null;

  // Keep the URL in step with the carousel so a shopper can share or reopen the
  // exact suit they were looking at. replaceState, not push — the back button
  // should leave the app, not walk backwards through suit changes.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('item_id') === garment.id) return;
    url.searchParams.set('item_id', garment.id);
    window.history.replaceState({}, '', url);
  }, [garment.id]);

  // One merged setState per report; TryOnStage already throttles fps to 2/sec.
  const handleStats = useCallback((patch) => {
    setStats((prev) => {
      const next = { ...prev, ...patch };
      return next.fps === prev.fps && next.tracking === prev.tracking ? prev : next;
    });
  }, []);

  const resetFit = useCallback(() => {
    const base = GARMENTS.find((g) => g.id === activeId);
    setFits((prev) => ({ ...prev, [activeId]: { ...base.fit, anchor: { ...base.fit.anchor } } }));
    setOpacity(1);
  }, [activeId]);

  const setFit = useCallback(
    (next) => setFits((prev) => ({ ...prev, [activeId]: next })),
    [activeId],
  );

  const ready = camera.status === 'ready' && model.status === 'ready';

  // The button needs a prepared garment asset, a settled camera, and a body the
  // tracker can actually see. Firing without a person in frame burns a paid
  // Replicate call to render a photo of an empty room.
  const canTryOn = ready && garment.product.ready && stats.tracking && tryOn.status === 'idle';

  return (
    <main className="relative h-full w-full overflow-hidden bg-black">
      <TryOnStage
        videoRef={camera.videoRef}
        landmarkerRef={model.landmarkerRef}
        garmentAsset={asset}
        fit={fit}
        mirrored={camera.facingMode === 'user'}
        showSkeleton={showSkeleton}
        opacity={opacity}
        onStats={handleStats}
      />

      {ready && (
        <>
          <TopBar
            garment={garment}
            fps={stats.fps}
            tracking={stats.tracking}
            tuning={tuning}
            onFlip={camera.flip}
            onToggleTune={() => setTuning((v) => !v)}
          />

          {/*
            Docked right rather than stacked above the carousel. Calibration
            means watching yourself while you drag a slider, and a bottom sheet
            covers the hips — exactly what you need to see to place a hem or a
            waistband. The column keeps the centre of frame clear.
          */}
          {tuning && (
            <aside
              className="absolute inset-y-0 right-0 z-30 flex w-[min(19rem,45vw)] flex-col justify-center overflow-y-auto px-2 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-[calc(env(safe-area-inset-top)+4rem)] sm:px-3"
              aria-label="Fit calibration"
            >
              <FitTuner
                garment={garment}
                fit={fit}
                onChange={setFit}
                opacity={opacity}
                onOpacityChange={setOpacity}
                showSkeleton={showSkeleton}
                onSkeletonChange={setShowSkeleton}
                onReset={resetFit}
              />
            </aside>
          )}

          <div className="absolute inset-x-0 bottom-0 z-20 pb-[env(safe-area-inset-bottom)]">
            <div
              className={`bg-gradient-to-t from-black/85 via-black/55 to-transparent pb-4 pt-12 transition-[padding] ${
                tuning ? 'pr-[min(19rem,45vw)]' : ''
              }`}
            >
              <GarmentCarousel garments={GARMENTS} activeId={garment.id} onSelect={setActiveId} />

              <div className="mt-3 flex flex-col items-center gap-1.5 px-4">
                <button
                  type="button"
                  onClick={() =>
                    tryOn.run(camera.videoRef.current, garment, {
                      mirror: camera.facingMode === 'user',
                    })
                  }
                  disabled={!canTryOn}
                  title={
                    garment.product.ready
                      ? 'Generate a photorealistic try-on with IDM-VTON'
                      : 'This item has no prepared garment asset yet'
                  }
                  className="flex items-center gap-2.5 rounded-full bg-white px-7 py-3.5 text-[15px] font-semibold text-black shadow-lg transition active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-white/25 disabled:text-white/40 disabled:shadow-none"
                  aria-label="Generate a photorealistic AI try-on"
                >
                  <span aria-hidden className="text-base leading-none">✦</span>
                  Try It On (AI)
                </button>
                <p className="text-[11px] text-white/35">
                  {!garment.product.ready
                    ? 'No garment asset prepared for this item yet'
                    : !stats.tracking
                      ? 'Step into frame first'
                      : 'Uses your camera frame — the overlay above is only a guide'}
                </p>
              </div>
            </div>
          </div>

          {!matched && itemIdFromUrl() && (
            <p className="pointer-events-none absolute inset-x-4 top-1/2 z-20 rounded-xl bg-amber-500/15 px-3 py-2 text-center text-xs text-amber-200 ring-1 ring-amber-400/30">
              Unknown item code — showing {garment.name} instead.
            </p>
          )}
        </>
      )}

      <TryOnResult
        status={tryOn.status}
        result={tryOn.result}
        captured={tryOn.captured}
        error={tryOn.error}
        elapsed={tryOn.elapsed}
        garment={garment}
        onCancel={tryOn.cancel}
        onClose={tryOn.reset}
        onRetry={() =>
          tryOn.run(camera.videoRef.current, garment, { mirror: camera.facingMode === 'user' })
        }
      />

      <StatusLayer
        camera={camera}
        model={model}
        assetsFailed={failed}
        onRetry={() => camera.start(camera.facingMode)}
      />
    </main>
  );
}
