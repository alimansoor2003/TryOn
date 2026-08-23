/**
 * Grabs a still from the live camera for the AI try-on.
 *
 * Deliberately captures the RAW VIDEO, never the canvas with the AR overlay on
 * it. The 2D overlay is an alignment guide; baking it into the photo would hand
 * IDM-VTON a person who is already wearing a flat sticker of the garment, and
 * the model would try to dress that. What it needs is the plain person.
 */

/** IDM-VTON is trained on 768x1024 humans. Sending much more is upload weight
 *  the model immediately throws away. */
const MAX_EDGE = 1024;

/**
 * Scales a frame to fit inside `maxEdge` without enlarging it or changing its
 * aspect ratio. Pure, so the sizing is testable without a camera.
 *
 * @returns {{width:number, height:number, scale:number}}
 */
export function captureDimensions(videoWidth, videoHeight, maxEdge = MAX_EDGE) {
  if (!videoWidth || !videoHeight) return { width: 0, height: 0, scale: 1 };
  const longest = Math.max(videoWidth, videoHeight);
  // Never upscale: inventing pixels adds payload without adding detail.
  const scale = longest > maxEdge ? maxEdge / longest : 1;
  return {
    width: Math.round(videoWidth * scale),
    height: Math.round(videoHeight * scale),
    scale,
  };
}

/**
 * @param {HTMLVideoElement} video
 * @param {{mirror?:boolean, maxEdge?:number, quality?:number}} opts
 * @returns {{dataUrl:string, width:number, height:number, bytes:number}}
 */
export function captureFrame(video, { mirror = false, maxEdge = MAX_EDGE, quality = 0.88 } = {}) {
  if (!video?.videoWidth) throw new Error('The camera is not ready yet.');

  const { width, height } = captureDimensions(video.videoWidth, video.videoHeight, maxEdge);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (mirror) {
    // The front camera is shown mirrored so it behaves like a mirror. Capturing
    // unmirrored would hand back a result flipped from what the shopper was just
    // looking at, which reads as the app having swapped their body around.
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, 0, 0, width, height);

  // JPEG, not PNG: a camera frame is photographic, and PNG would be several
  // times larger for no visible gain against Vercel's request body cap.
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);

  return { dataUrl, width, height, bytes: Math.floor((base64.length * 3) / 4) };
}
