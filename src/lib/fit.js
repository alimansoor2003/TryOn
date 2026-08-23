import { LM } from './landmarks.js';

/** Below this MediaPipe visibility score we treat a joint as "not really seen". */
const MIN_VISIBILITY = 0.55;

/**
 * Average adult torso length (shoulder line -> hip line) expressed in shoulder
 * widths. Used to turn measured torso height into a length correction so a
 * long-torsoed shopper doesn't get a jacket that stops at the ribs.
 */
const NOMINAL_TORSO_RATIO = 1.45;

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function visible(landmarks, index) {
  const lm = landmarks[index];
  // The Tasks API omits `visibility` on some builds; absence means "trust it".
  return lm && (lm.visibility === undefined || lm.visibility >= MIN_VISIBILITY);
}

/**
 * Turns a pose into everything needed to stamp the garment onto the canvas.
 *
 * @param {Array<{x:number,y:number,visibility?:number}>} landmarks normalized pose
 * @param {(lm:{x:number,y:number}) => {x:number,y:number}} project normalized -> CSS px
 * @param {{anchor:{x:number,y:number}, shoulderSpan:number, widthFactor:number, offsetY:number}} fit
 * @param {{width:number,height:number}} imageSize intrinsic size of the garment art
 * @returns {null | {x:number,y:number,angle:number,width:number,height:number,anchor:{x:number,y:number},shoulderWidth:number,confidence:number}}
 */
export function computeGarmentTransform(landmarks, project, fit, imageSize) {
  if (!landmarks || landmarks.length < 25) return null;

  const needed = [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_HIP, LM.RIGHT_HIP];
  if (!needed.every((i) => visible(landmarks, i))) return null;

  const leftShoulder = project(landmarks[LM.LEFT_SHOULDER]);
  const rightShoulder = project(landmarks[LM.RIGHT_SHOULDER]);
  const shoulderMid = midpoint(leftShoulder, rightShoulder);
  const hipMid = midpoint(project(landmarks[LM.LEFT_HIP]), project(landmarks[LM.RIGHT_HIP]));

  // Shoulder line, pointing from the wearer's right shoulder to their left.
  const vx = leftShoulder.x - rightShoulder.x;
  const vy = leftShoulder.y - rightShoulder.y;
  const shoulderWidth = Math.hypot(vx, vy);

  // Too small to be a real torso: usually a half-detected person at the edge of
  // frame. Rendering here produces a postage-stamp jacket floating in space.
  if (shoulderWidth < 24) return null;

  // Roll: the garment's shoulder seam follows the wearer's shoulder line.
  const angle = Math.atan2(vy, vx);

  // Torso "down" axis = shoulder line rotated 90 degrees (canvas y grows down).
  const downX = -vy / shoulderWidth;
  const downY = vx / shoulderWidth;

  // Width comes from the shoulders; the PNG's own shoulder span tells us how
  // much of the artwork that span represents.
  const width = (shoulderWidth * fit.widthFactor) / fit.shoulderSpan;

  // Height follows the artwork's aspect, then gets a bounded correction from
  // the measured torso so proportions track the actual body.
  const torsoLength = Math.hypot(hipMid.x - shoulderMid.x, hipMid.y - shoulderMid.y);
  const lengthCorrection = clamp(
    torsoLength / (NOMINAL_TORSO_RATIO * shoulderWidth),
    0.82,
    1.22,
  );
  const height = width * (imageSize.height / imageSize.width) * lengthCorrection;

  // Anchor sits on the shoulder line, nudged along the torso axis.
  const slide = fit.offsetY * shoulderWidth;

  return {
    x: shoulderMid.x + downX * slide,
    y: shoulderMid.y + downY * slide,
    angle,
    width,
    height,
    anchor: fit.anchor,
    shoulderWidth,
    // Rough proxy for "is this pose worth trusting" — used only for UI hints.
    confidence: Math.min(
      1,
      needed.reduce((sum, i) => sum + (landmarks[i].visibility ?? 1), 0) / needed.length,
    ),
  };
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {CanvasImageSource} image
 * @param {ReturnType<typeof computeGarmentTransform>} t
 * @param {number} opacity
 */
export function drawGarment(ctx, image, t, opacity = 1) {
  if (!t) return;
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.translate(t.x, t.y);
  ctx.rotate(t.angle);
  ctx.drawImage(
    image,
    -t.anchor.x * t.width,
    -t.anchor.y * t.height,
    t.width,
    t.height,
  );
  ctx.restore();
}
