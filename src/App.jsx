import { useCallback, useEffect, useMemo, useState } from 'react';
import CameraView from './components/CameraView.jsx';
import CaptureBar from './components/CaptureBar.jsx';
import ConfirmPhoto from './components/ConfirmPhoto.jsx';
import TopBar from './components/TopBar.jsx';
import GarmentCarousel from './components/GarmentCarousel.jsx';
import TryOnResult from './components/TryOnResult.jsx';
import StatusLayer from './components/StatusLayer.jsx';
import { useCamera } from './hooks/useCamera.js';
import { useTryOn } from './hooks/useTryOn.js';
import { captureFrame, loadImageFile } from './lib/photo.js';
import { GARMENTS, resolveGarment } from './data/garments.js';

/** Reads ?item_id=TEE_01 off the QR-code URL. */
function itemIdFromUrl() {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('item_id');
}

/**
 * Photo-AI try-on flow:
 *
 *   camera  ->  confirm  ->  processing  ->  result
 *                  |                            |
 *                  +--------- retake -----------+
 *
 * The only transition out of `camera` is a deliberate press of the shutter or a
 * file the shopper picked. Nothing here observes the video, and no timer exists
 * anywhere in this component — the camera is a viewfinder, not a sensor.
 */
export default function App() {
  const [{ garment: initial, matched }] = useState(() => resolveGarment(itemIdFromUrl()));
  const [activeId, setActiveId] = useState(initial.id);
  const [photo, setPhoto] = useState(null);
  const [photoError, setPhotoError] = useState(null);

  const camera = useCamera({ autoStart: true });
  const tryOn = useTryOn();

  const garment = useMemo(
    () => GARMENTS.find((g) => g.id === activeId) ?? GARMENTS[0],
    [activeId],
  );

  // Keep the URL in step with the carousel so a shopper can share or reopen the
  // exact item they were looking at. replaceState, not push — the back button
  // should leave the app, not walk backwards through garment changes.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('item_id') === garment.id) return;
    url.searchParams.set('item_id', garment.id);
    window.history.replaceState({}, '', url);
  }, [garment.id]);

  const takePhoto = useCallback(() => {
    setPhotoError(null);
    try {
      setPhoto(captureFrame(camera.videoRef.current, { mirror: camera.facingMode === 'user' }));
    } catch (err) {
      setPhotoError(err.message);
    }
  }, [camera.videoRef, camera.facingMode]);

  const choosePhoto = useCallback(async (file) => {
    setPhotoError(null);
    try {
      setPhoto(await loadImageFile(file));
    } catch (err) {
      setPhotoError(err.message);
    }
  }, []);

  const retake = useCallback(() => {
    setPhoto(null);
    setPhotoError(null);
    tryOn.reset();
  }, [tryOn]);

  // "Try another garment" keeps the photo: the shopper already stood still for
  // it, and making them pose again to see a second item is the fastest way to
  // end a demo early.
  const tryAnother = useCallback(() => tryOn.reset(), [tryOn]);

  const ready = camera.status === 'ready';
  const confirming = Boolean(photo) && tryOn.status === 'idle';

  return (
    <main className="relative h-full w-full overflow-hidden bg-black">
      <CameraView
        videoRef={camera.videoRef}
        mirrored={camera.facingMode === 'user'}
        showGuide={ready && !photo}
      />

      {ready && !photo && (
        <>
          <TopBar garment={garment} onFlip={camera.flip} />

          <div className="absolute inset-x-0 bottom-0 z-20 pb-[env(safe-area-inset-bottom)]">
            <div className="bg-gradient-to-t from-black/85 via-black/55 to-transparent pb-5 pt-12">
              <GarmentCarousel garments={GARMENTS} activeId={garment.id} onSelect={setActiveId} />

              <div className="mt-4">
                <CaptureBar
                  onCapture={takePhoto}
                  onFile={choosePhoto}
                  disabled={!ready}
                  busy={false}
                  garmentName={garment.name}
                />
              </div>

              {photoError && (
                <p className="mt-3 px-6 text-center text-xs text-rose-300">{photoError}</p>
              )}
            </div>
          </div>

          {!matched && itemIdFromUrl() && (
            <p className="pointer-events-none absolute inset-x-4 top-24 z-20 rounded-xl bg-amber-500/15 px-3 py-2 text-center text-xs text-amber-200 ring-1 ring-amber-400/30">
              Unknown item code — showing {garment.name} instead.
            </p>
          )}
        </>
      )}

      {confirming && (
        <ConfirmPhoto
          photo={photo}
          garment={garment}
          garments={GARMENTS}
          onSelect={setActiveId}
          onRetake={retake}
          onConfirm={() => tryOn.submit(photo.dataUrl, garment)}
        />
      )}

      <TryOnResult
        status={tryOn.status}
        result={tryOn.result}
        captured={photo?.dataUrl}
        error={tryOn.error}
        elapsed={tryOn.elapsed}
        garment={garment}
        onCancel={tryOn.cancel}
        onClose={tryAnother}
        onRetake={retake}
        onRetry={() => photo && tryOn.submit(photo.dataUrl, garment)}
      />

      <StatusLayer
        camera={camera}
        onRetry={() => camera.start(camera.facingMode)}
      />
    </main>
  );
}
