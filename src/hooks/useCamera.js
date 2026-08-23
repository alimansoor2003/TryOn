import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Camera lifecycle for the AR viewfinder.
 *
 * Two things drive the shape of this hook:
 *  - getUserMedia only exists in a secure context, and a QR-code demo is
 *    guaranteed to be opened on a phone over the network, so a plain http://
 *    LAN address silently has no `mediaDevices` at all. We detect that and say
 *    so, instead of surfacing a generic "camera failed".
 *  - iOS Safari will reject or stall an autoplaying stream that isn't muted +
 *    playsInline, and sometimes refuses the prompt outside a user gesture. We
 *    try automatically on mount (per the PRD) and fall back to a tap-to-enable
 *    gate when that attempt is refused.
 */

/** @typedef {'idle'|'requesting'|'ready'|'denied'|'unsupported'|'error'} CameraStatus */

const BASE_CONSTRAINTS = {
  width: { ideal: 1280 },
  height: { ideal: 720 },
  frameRate: { ideal: 30, max: 30 },
};

function describe(err) {
  switch (err?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Camera access was blocked. Allow the camera for this site, then reload.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'No usable camera was found on this device.';
    case 'NotReadableError':
      return 'The camera is already in use by another app. Close it and try again.';
    default:
      return err?.message || 'The camera could not be started.';
  }
}

export function useCamera({ autoStart = true } = {}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [status, setStatus] = useState(/** @type {CameraStatus} */ ('idle'));
  const [error, setError] = useState(null);
  const [facingMode, setFacingMode] = useState('user');
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const start = useCallback(
    async (mode = facingMode) => {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setStatus('unsupported');
        setError(
          'This page needs HTTPS to use the camera. Open the deployed https:// URL rather than a plain http:// address.',
        );
        return;
      }

      setStatus('requesting');
      setError(null);
      stop();

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { ...BASE_CONSTRAINTS, facingMode: { ideal: mode } },
          audio: false,
        });
        streamRef.current = stream;

        const video = videoRef.current;
        if (!video) {
          // Unmounted mid-request; don't leave the camera light on.
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;
        await video.play();

        setDimensions({ width: video.videoWidth, height: video.videoHeight });
        setFacingMode(mode);
        setStatus('ready');
      } catch (err) {
        stop();
        setError(describe(err));
        setStatus(
          err?.name === 'NotAllowedError' || err?.name === 'SecurityError' ? 'denied' : 'error',
        );
      }
    },
    [facingMode, stop],
  );

  const flip = useCallback(() => {
    start(facingMode === 'user' ? 'environment' : 'user');
  }, [facingMode, start]);

  // Kick off one attempt on mount. If the browser wants a gesture first, the
  // caller renders the tap-to-enable gate off the resulting status.
  useEffect(() => {
    if (autoStart) start('user');
    return stop;
    // Intentionally mount-only: re-running this would restart the camera on
    // every facingMode change, which `start` already handles itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Camera resolution isn't known until metadata lands, and it changes when the
  // phone rotates. The projection math depends on it, so keep it in state.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const sync = () => setDimensions({ width: video.videoWidth, height: video.videoHeight });
    video.addEventListener('loadedmetadata', sync);
    video.addEventListener('resize', sync);
    return () => {
      video.removeEventListener('loadedmetadata', sync);
      video.removeEventListener('resize', sync);
    };
  }, []);

  return { videoRef, status, error, facingMode, dimensions, start, stop, flip };
}
