import { useEffect, useState } from 'react';

/**
 * Decodes every garment overlay up front.
 *
 * Loading lazily on carousel tap means the first tap shows a bare body for a
 * few hundred milliseconds, which reads as a bug. Three small images is a
 * trivial preload budget, and the PRD caps the demo at three suits anyway.
 */
export function useGarmentImages(garments) {
  const [images, setImages] = useState(() => new Map());
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState([]);

  useEffect(() => {
    let cancelled = false;

    const load = (garment) =>
      new Promise((resolve) => {
        const img = new Image();
        // Same-origin assets, but set this anyway so a future CDN move doesn't
        // silently taint the canvas and break Phase 4's frame capture.
        img.crossOrigin = 'anonymous';
        img.decoding = 'async';
        img.onload = () => resolve({ garment, img });
        img.onerror = () => resolve({ garment, img: null });
        img.src = garment.fit.src;
      });

    Promise.all(garments.map(load)).then((results) => {
      if (cancelled) return;
      const map = new Map();
      const bad = [];
      for (const { garment, img } of results) {
        if (img) map.set(garment.id, { image: img, size: { width: img.naturalWidth, height: img.naturalHeight } });
        else bad.push(garment.id);
      }
      setImages(map);
      setFailed(bad);
      setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [garments]);

  return { images, ready, failed };
}
