import { LM } from './landmarks.js';

/** Below this MediaPipe visibility score we treat a joint as "not really seen". */
const MIN_VISIBILITY = 0.55;

/**
 * Reference line is too short to be a real body part — usually a half-detected
 * person at the edge of frame. Rendering here produces a postage-stamp garment
 * floating in space.
 */
const MIN_REFERENCE_PX = 24;

/**
 * Where a garment hangs from.
 *
 * `reference` is the pair of joints that gives the garment its width, angle and
 * position. `extent` is the pair further down the body used only to correct
 * length, and is optional at runtime: hips leave the frame in a close crop, and
 * knees leave it in almost any try-on framing. Losing them should cost the
 * length correction, not the whole overlay.
 *
 * `nominalExtentRatio` is the distance from the reference line to the extent
 * line on an average adult, expressed in reference-line widths.
 */
const REGIONS = {
  upper: {
    reference: [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER],
    extent: [LM.LEFT_HIP, LM.RIGHT_HIP],
    // Adult male: ~39cm biacromial breadth, ~50cm acromion to hip joint.
    nominalExtentRatio: 1.3,
  },
  lower: {
    reference: [LM.LEFT_HIP, LM.RIGHT_HIP],
    extent: [LM.LEFT_KNEE, LM.RIGHT_KNEE],
    // Adult male: ~19cm between hip joint centres, ~40cm hip to knee. Note
    // this is roughly 2x the upper-body ratio — the hip landmarks sit much
    // closer together than the shoulders, so reusing the upper-body number
    // here would peg the length correction to its clamp on every real body.
    nominalExtentRatio: 2.1,
  },
};

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function visible(landmarks, index) {
  const lm = landmarks[index];
  // The Tasks API omits `visibility` on some builds; absence means "trust it".
  return Boolean(lm) && (lm.visibility === undefined || lm.visibility >= MIN_VISIBILITY);
}

/**
 * Turns a pose into everything needed to stamp the garment onto the canvas.
 *
 * @param {Array<{x:number,y:number,visibility?:number}>} landmarks normalized pose
 * @param {(lm:{x:number,y:number}) => {x:number,y:number}} project normalized -> CSS px
 * @param {{region?:'upper'|'lower', anchor:{x:number,y:number}, span:number, widthFactor:number, offsetY:number}} fit
 * @param {{width:number,height:number}} imageSize intrinsic size of the garment art
 */
export function computeGarmentTransform(landmarks, project, fit, imageSize) {
  const region = REGIONS[fit.region ?? 'upper'];
  if (!region) return null;

  const [leftIdx, rightIdx] = region.reference;
  if (!landmarks || landmarks.length <= Math.max(leftIdx, rightIdx)) return null;
  if (!visible(landmarks, leftIdx) || !visible(landmarks, rightIdx)) return null;

  const left = project(landmarks[leftIdx]);
  const right = project(landmarks[rightIdx]);
  const referenceMid = midpoint(left, right);

  // Reference line, pointing from the wearer's right side to their left.
  const vx = left.x - right.x;
  const vy = left.y - right.y;
  const referenceWidth = Math.hypot(vx, vy);
  if (referenceWidth < MIN_REFERENCE_PX) return null;

  // Roll: the garment follows the tilt of the joints it hangs from.
  const angle = Math.atan2(vy, vx);

  // Body "down" axis = reference line rotated 90 degrees (canvas y grows down).
  const downX = -vy / referenceWidth;
  const downY = vx / referenceWidth;

  // Width comes from the body; the artwork's own span tells us how much of the
  // image that measurement covers.
  const width = (referenceWidth * fit.widthFactor) / fit.span;

  // Height follows the artwork's aspect, then takes a bounded correction from
  // the measured body so proportions track the wearer. The correction is
  // skipped rather than guessed when the lower joints are out of frame.
  const [extentLeft, extentRight] = region.extent;
  let lengthCorrection = 1;
  if (visible(landmarks, extentLeft) && visible(landmarks, extentRight)) {
    const extentMid = midpoint(project(landmarks[extentLeft]), project(landmarks[extentRight]));
    const reach = Math.hypot(extentMid.x - referenceMid.x, extentMid.y - referenceMid.y);
    lengthCorrection = clamp(reach / (region.nominalExtentRatio * referenceWidth), 0.82, 1.22);
  }
  const height = width * (imageSize.height / imageSize.width) * lengthCorrection;

  // Anchor sits on the reference line, nudged along the body axis.
  const slide = fit.offsetY * referenceWidth;

  return {
    x: referenceMid.x + downX * slide,
    y: referenceMid.y + downY * slide,
    angle,
    width,
    height,
    anchor: fit.anchor,
    referenceWidth,
    // Rough proxy for "is this pose worth trusting" — used only for UI hints.
    confidence: Math.min(
      1,
      ((landmarks[leftIdx].visibility ?? 1) + (landmarks[rightIdx].visibility ?? 1)) / 2,
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
  ctx.drawImage(image, -t.anchor.x * t.width, -t.anchor.y * t.height, t.width, t.height);
  ctx.restore();
}
