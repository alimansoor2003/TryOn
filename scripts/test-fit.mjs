/**
 * Sanity checks for the garment fitting math. The AR path can't be exercised
 * without a camera and a body, so the geometry gets tested directly.
 * Run: node scripts/test-fit.mjs
 */
import assert from 'node:assert/strict';
import { computeGarmentTransform } from '../src/lib/fit.js';
import { LM } from '../src/lib/landmarks.js';

const FIT = {
  region: 'upper',
  anchor: { x: 0.5, y: 0.19 },
  span: 0.62,
  widthFactor: 1.3,
  offsetY: 0.02,
};

const LOWER_FIT = { ...FIT, region: 'lower' };
const IMAGE = { width: 1000, height: 1400 };
const project = (lm) => ({ x: lm.x * 1000, y: lm.y * 1000 });

/** Builds a pose. `roll` tips the shoulder line, in radians. */
function pose({
  roll = 0,
  torso = 0.25,
  half = 0.1,
  visibility = 1,
  cx = 0.5,
  cy = 0.3,
  hipVisibility = null,
  kneeVisibility = null,
} = {}) {
  const lms = Array.from({ length: 33 }, () => ({ x: cx, y: cy, visibility }));
  const dx = Math.cos(roll) * half;
  const dy = Math.sin(roll) * half;
  // Landmark 11 is the wearer's LEFT shoulder, which sits at the larger x in a
  // front-facing, un-mirrored frame.
  lms[LM.LEFT_SHOULDER] = { x: cx + dx, y: cy + dy, visibility };
  lms[LM.RIGHT_SHOULDER] = { x: cx - dx, y: cy - dy, visibility };

  const hipV = hipVisibility ?? visibility;
  const hipY = cy + torso;
  const hipHalf = half * 0.8;
  lms[LM.LEFT_HIP] = { x: cx + hipHalf, y: hipY, visibility: hipV };
  lms[LM.RIGHT_HIP] = { x: cx - hipHalf, y: hipY, visibility: hipV };

  const kneeV = kneeVisibility ?? visibility;
  const kneeY = hipY + hipHalf * 2 * 2.1;
  lms[LM.LEFT_KNEE] = { x: cx + hipHalf, y: kneeY, visibility: kneeV };
  lms[LM.RIGHT_KNEE] = { x: cx - hipHalf, y: kneeY, visibility: kneeV };
  return lms;
}

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

test('upright pose sits level and scales off the reference width', () => {
  const t = computeGarmentTransform(pose(), project, FIT, IMAGE);
  assert.ok(t, 'expected a transform');
  assert.equal(Math.round(t.angle * 1e6) / 1e6, 0);
  assert.equal(Math.round(t.referenceWidth), 200);
  // width = shoulderWidth * widthFactor / shoulderSpan
  assert.equal(Math.round(t.width), Math.round((200 * 1.3) / 0.62));
});

test('shoulder tilt rotates the garment by the same angle', () => {
  const roll = Math.PI / 12; // 15 degrees
  const t = computeGarmentTransform(pose({ roll }), project, FIT, IMAGE);
  assert.ok(Math.abs(t.angle - roll) < 1e-9, `angle ${t.angle} != ${roll}`);
});

test('anchor slides down the torso axis, not straight down the screen', () => {
  const roll = Math.PI / 2; // shoulder line vertical => torso axis horizontal
  const t = computeGarmentTransform(pose({ roll }), project, FIT, IMAGE);
  const slide = FIT.offsetY * t.referenceWidth;
  // "down" is the shoulder vector rotated 90deg; with a vertical shoulder line
  // that points along -x, so the anchor must move horizontally.
  assert.ok(Math.abs(t.x - (500 - slide)) < 1e-6, `x drifted: ${t.x}`);
  assert.ok(Math.abs(t.y - 300) < 1e-6, `y should not move: ${t.y}`);
});

test('a longer torso lengthens the garment, within bounds', () => {
  const short = computeGarmentTransform(pose({ torso: 0.2 }), project, FIT, IMAGE);
  const long = computeGarmentTransform(pose({ torso: 0.34 }), project, FIT, IMAGE);
  assert.ok(long.height > short.height, 'longer torso should give a longer jacket');
  assert.equal(short.width, long.width, 'width must not follow torso length');
});

test('length correction is clamped so a bad hip detection cannot explode it', () => {
  const absurd = computeGarmentTransform(pose({ torso: 5 }), project, FIT, IMAGE);
  const nominal = computeGarmentTransform(pose({ torso: 0.29 }), project, FIT, IMAGE);
  const maxHeight = nominal.width * (IMAGE.height / IMAGE.width) * 1.22;
  assert.ok(absurd.height <= maxHeight + 1e-6, `unclamped height ${absurd.height}`);
});

test('low-visibility joints return no transform instead of a guess', () => {
  assert.equal(computeGarmentTransform(pose({ visibility: 0.2 }), project, FIT, IMAGE), null);
});

test('a person too small in frame returns no transform', () => {
  assert.equal(computeGarmentTransform(pose({ half: 0.005 }), project, FIT, IMAGE), null);
});

test('a truncated landmark array is rejected', () => {
  assert.equal(computeGarmentTransform(pose().slice(0, 5), project, FIT, IMAGE), null);
});

// --- region handling -------------------------------------------------------

test('an upper-body garment still renders when the hips leave frame', () => {
  // A close crop loses the hips. Losing the length correction is acceptable;
  // dropping the whole overlay is not.
  const t = computeGarmentTransform(pose({ hipVisibility: 0.1 }), project, FIT, IMAGE);
  assert.ok(t, 'expected a transform without hips');
  assert.equal(Math.round(t.height), Math.round(t.width * (IMAGE.height / IMAGE.width)));
});

test('a lower-body garment anchors to the hips, not the shoulders', () => {
  const p = pose();
  const upper = computeGarmentTransform(p, project, FIT, IMAGE);
  const lower = computeGarmentTransform(p, project, LOWER_FIT, IMAGE);
  assert.ok(lower, 'expected a lower-body transform');
  // Hips sit `torso` below the shoulders, so the anchor must move down.
  assert.ok(lower.y > upper.y + 100, `lower anchor at ${lower.y} vs upper ${upper.y}`);
  // Hip span is 0.8x the shoulder span in the fixture, so it must scale smaller.
  assert.ok(lower.width < upper.width, 'hip-anchored width should be narrower');
});

test('a lower-body garment still renders when the knees leave frame', () => {
  const t = computeGarmentTransform(pose({ kneeVisibility: 0.1 }), project, LOWER_FIT, IMAGE);
  assert.ok(t, 'knees are out of frame in almost any try-on framing');
  assert.equal(Math.round(t.height), Math.round(t.width * (IMAGE.height / IMAGE.width)));
});

test('a lower-body garment is rejected when the hips are not visible', () => {
  assert.equal(
    computeGarmentTransform(pose({ hipVisibility: 0.1 }), project, LOWER_FIT, IMAGE),
    null,
  );
});

test('an unknown region is rejected rather than silently defaulting', () => {
  assert.equal(
    computeGarmentTransform(pose(), project, { ...FIT, region: 'sideways' }, IMAGE),
    null,
  );
});

let failed = 0;
for (const [name, fn] of tests) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`  FAIL  ${name}\n        ${err.message}`);
  }
}
console.log(`\n${tests.length - failed}/${tests.length} passed`);
process.exit(failed ? 1 : 0);
