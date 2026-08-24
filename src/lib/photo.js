/**
 * Turning either source of a photo — the live camera or a file the shopper
 * picked — into the same normalised base64 payload.
 *
 * Both paths land here so the endpoint only ever sees one shape of input, and
 * so a 12-megapixel phone photo gets the same downscale as a webcam frame
 * rather than being posted whole.
 */

/** IDM-VTON works on 768x1024 humans. Sending much more is upload weight the
 *  model immediately throws away. */
const MAX_EDGE = 1024;

/** Guard against someone picking a RAW file or a panorama from their gallery. */
const MAX_FILE_BYTES = 25 * 1024 * 1024;

/**
 * Scales to fit inside `maxEdge` without enlarging or changing aspect ratio.
 * Pure, so the sizing is testable without a camera or a file picker.
 *
 * @returns {{width:number, height:number, scale:number}}
 */
export function fitDimensions(sourceWidth, sourceHeight, maxEdge = MAX_EDGE) {
  if (!sourceWidth || !sourceHeight) return { width: 0, height: 0, scale: 1 };
  const longest = Math.max(sourceWidth, sourceHeight);
  // Never upscale: inventing pixels adds payload without adding detail.
  const scale = longest > maxEdge ? maxEdge / longest : 1;
  return {
    width: Math.round(sourceWidth * scale),
    height: Math.round(sourceHeight * scale),
    scale,
  };
}

function encode(source, width, height, { mirror = false, quality = 0.88 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (mirror) {
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(source, 0, 0, width, height);

  // JPEG, not PNG: a photograph, and PNG would be several times larger for no
  // visible gain against the request body cap.
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  return { dataUrl, width, height, bytes: Math.floor((base64.length * 3) / 4) };
}

/**
 * Grabs the exact frame currently showing in the video element.
 *
 * Only ever called from the shutter's click handler. There is no timer and no
 * automatic capture anywhere in this codebase: a camera that takes pictures on
 * its own, in a shop, pointed at a person, is not something to build by
 * accident.
 *
 * @param {HTMLVideoElement} video
 * @param {{mirror?:boolean, maxEdge?:number, quality?:number}} opts
 */
export function captureFrame(video, { mirror = false, maxEdge = MAX_EDGE, quality = 0.88 } = {}) {
  if (!video?.videoWidth) throw new Error('The camera is not ready yet.');
  const { width, height } = fitDimensions(video.videoWidth, video.videoHeight, maxEdge);
  // The front camera is shown mirrored so it behaves like a mirror. Capturing
  // unmirrored hands back a photo flipped from the one just on screen.
  return encode(video, width, height, { mirror, quality });
}

/**
 * Reads a file the shopper chose and normalises it the same way.
 *
 * @param {File} file
 * @returns {Promise<{dataUrl:string,width:number,height:number,bytes:number}>}
 */
export function loadImageFile(file, { maxEdge = MAX_EDGE, quality = 0.88 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('No file was chosen.'));
    if (!file.type.startsWith('image/')) {
      return reject(new Error(`That is a ${file.type || 'unknown'} file. Choose a photo.`));
    }
    if (file.size > MAX_FILE_BYTES) {
      return reject(
        new Error(`That photo is ${(file.size / 1024 / 1024).toFixed(0)}MB. Choose one under 25MB.`),
      );
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const { width, height } = fitDimensions(img.naturalWidth, img.naturalHeight, maxEdge);
        // Gallery photos are never mirrored — they are already the right way
        // round, unlike a front-camera preview.
        resolve(encode(img, width, height, { mirror: false, quality }));
      } catch (err) {
        reject(err);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('That image could not be read. Try a JPEG or PNG.'));
    };
    img.src = objectUrl;
  });
}
