import { useCallback, useEffect, useMemo, useState } from 'react';
import TryOnStage from './components/TryOnStage.jsx';
import TopBar from './components/TopBar.jsx';
import GarmentCarousel from './components/GarmentCarousel.jsx';
import FitTuner from './components/FitTuner.jsx';
import StatusLayer from './components/StatusLayer.jsx';
import { useCamera } from './hooks/useCamera.js';
import { usePoseLandmarker } from './hooks/usePoseLandmarker.js';
import { useGarmentImages } from './hooks/useGarmentImages.js';
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

          <div className="absolute inset-x-0 bottom-0 z-20 pb-[env(safe-area-inset-bottom)]">
            <div className="bg-gradient-to-t from-black/85 via-black/55 to-transparent pb-4 pt-12">
              {tuning && (
                <div className="mb-3 px-4">
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
                </div>
              )}

              <GarmentCarousel garments={GARMENTS} activeId={garment.id} onSelect={setActiveId} />

              <div className="mt-3 flex flex-col items-center gap-1.5 px-4">
                <button
                  type="button"
                  disabled
                  title="Phase 4: needs a real product photograph before IDM-VTON can run"
                  className="flex size-16 items-center justify-center rounded-full border-4 border-white/25 bg-white/15 text-white/40 disabled:cursor-not-allowed"
                  aria-label="Capture high-resolution try-on photo"
                >
                  <span className="size-11 rounded-full bg-current" />
                </button>
                <p className="text-[11px] text-white/35">
                  {garment.product.ready
                    ? 'Capture HD photo'
                    : 'HD capture unlocks once real product photos are added'}
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

      <StatusLayer
        camera={camera}
        model={model}
        assetsFailed={failed}
        onRetry={() => camera.start(camera.facingMode)}
      />
    </main>
  );
}
