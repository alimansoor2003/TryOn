import { useCallback, useEffect, useMemo, useState } from 'react';
import Landing from './components/Landing.jsx';
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
 *   landing  ->  camera  ->  confirm  ->  processing  ->  result
 *      |            |            |                          |
 *      +-- upload --+            +--------- retake ---------+
 *
 * `landing` is where a QR scan arrives: it names the scanned garment and shows
 * it, before asking for anything. Opening straight into a camera means the first
 * thing a shopper sees is their own face and a permission prompt, with no
 * indication of what they scanned or why the page wants a photo.
 *
 * The only transitions into `confirm` are a deliberate press of the shutter or a
 * file the shopper picked. Nothing here observes the video, and no timer exists
 * anywhere in this component — the camera is a viewfinder, not a sensor.
 */
export default function App() {
  const [{ garment: initial, matched }] = useState(() => resolveGarment(itemIdFromUrl()));
  const [activeId, setActiveId] = useState(initial.id);
  const [photo, setPhoto] = useState(null);
  const [photoError, setPhotoError] = useState(null);
  /** 'landing' until the shopper asks for the camera. */
  const [screen, setScreen] = useState('landing');

  // Not autoStart: the landing screen must render before anything asks for the
  // camera, or the permission prompt arrives over a page the shopper has not
  // read yet — which is both worse UX and a worse-converting prompt.
  const camera = useCamera({ autoStart: false });
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

  const openCamera = useCallback(() => {
    setScreen('camera');
    if (camera.status !== 'ready') camera.start('user');
  }, [camera]);

  const retake = useCallback(() => {
    setPhoto(null);
    setPhotoError(null);
    tryOn.reset();
    setScreen('camera');
    if (camera.status !== 'ready') camera.start('user');
  }, [tryOn, camera]);

  // "Try another garment" keeps the photo: the shopper already stood still for
  // it, and making them pose again to see a second item is the fastest way to
  // end a demo early.
  const tryAnother = useCallback(() => tryOn.reset(), [tryOn]);

  const ready = camera.status === 'ready';
  const confirming = Boolean(photo) && tryOn.status === 'idle';
  const onLanding = screen === 'landing' && !photo;

  return (
    <main className="relative h-full w-full overflow-hidden bg-black">
      {/* Kept mounted once the camera screen is reached so switching back and
          forth does not tear down and re-request the stream. */}
      {!onLanding && (
        <CameraView
          videoRef={camera.videoRef}
          mirrored={camera.facingMode === 'user'}
          showGuide={ready && !photo}
        />
      )}

      {onLanding && (
        <Landing
          garment={garment}
          garments={GARMENTS}
          matched={matched}
          onSelect={setActiveId}
          onTakePhoto={openCamera}
          onFile={choosePhoto}
        />
      )}

      {!onLanding && ready && !photo && (
        <>
          <TopBar garment={garment} onFlip={camera.flip} onBack={() => setScreen('landing')} />

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
        garments={GARMENTS}
        onCancel={tryOn.cancel}
        onClose={tryAnother}
        onRetake={retake}
        onRetry={() => photo && tryOn.submit(photo.dataUrl, garment)}
      />

      {/* Only meaningful once the camera has been asked for; on the landing
          screen there is nothing to report yet. */}
      {!onLanding && (
        <StatusLayer camera={camera} onRetry={() => camera.start(camera.facingMode)} />
      )}
    </main>
  );
}
