/**
 * The <video> element is laid out with object-fit: cover, so the frame is
 * cropped, not letterboxed. MediaPipe returns landmarks normalized to the FULL
 * frame, so drawing them straight onto the canvas puts the garment in the wrong
 * place on any device whose screen aspect differs from the camera's.
 *
 * This computes the same crop the browser applied, so canvas space and what the
 * shopper actually sees line up.
 */

/**
 * @param {{videoWidth:number, videoHeight:number}} video
 * @param {{width:number, height:number}} box  CSS pixel size of the display area
 */
export function coverProjection(video, box) {
  const vw = video.videoWidth || 1;
  const vh = video.videoHeight || 1;
  const scale = Math.max(box.width / vw, box.height / vh);
  const drawW = vw * scale;
  const drawH = vh * scale;
  const offsetX = (box.width - drawW) / 2;
  const offsetY = (box.height - drawH) / 2;

  /**
   * Normalized frame coords (0..1) -> CSS pixels within the display box.
   * @param {{x:number,y:number}} lm
   */
  return function project(lm) {
    return { x: offsetX + lm.x * drawW, y: offsetY + lm.y * drawH };
  };
}

/**
 * Sizes a canvas backing store to its CSS box at device pixel ratio, and
 * returns a context already scaled so all drawing can use CSS pixels.
 * DPR is capped at 2 — a 3x buffer on a tall phone screen costs real frames
 * for no visible gain on a live camera feed.
 */
export function prepareCanvas(canvas, box, maxDpr = 2) {
  const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  const w = Math.round(box.width * dpr);
  const h = Math.round(box.height * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, box.width, box.height);
  return ctx;
}
