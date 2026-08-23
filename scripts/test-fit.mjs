/**
 * Sanity checks for the garment fitting math. The AR path can't be exercised
 * without a camera and a body, so the geometry gets tested directly.
 * Run: node scripts/test-fit.mjs
 */
import assert from 'node:assert/strict';
import { computeGarmentTransform } from '../src/lib/fit.js';
import { LM } from '../src/lib/landmarks.js';

const FIT = {
  anchor: { x: 0.5, y: 0.19 },
  shoulderSpan: 0.62,
  widthFactor: 1.3,
  offsetY: 0.02,
};
const IMAGE = { width: 1000, height: 1400 };
const project = (lm) => ({ x: lm.x * 1000, y: lm.y * 1000 });

/** Builds a pose. `roll` tips the shoulder line, in radians. */
function pose({ roll = 0, torso = 0.25, half = 0.1, visibility = 1, cx = 0.5, cy = 0.3 } = {}) {
  const lms = Array.from({ length: 33 }, () => ({ x: cx, y: cy, visibility }));
  const dx = Math.cos(roll) * half;
  const dy = Math.sin(roll) * half;
  // Landmark 11 is the wearer's LEFT shoulder, which sits at the larger x in a
  // front-facing, un-mirrored frame.
  lms[LM.LEFT_SHOULDER] = { x: cx + dx, y: cy + dy, visibility };
  lms[LM.RIGHT_SHOULDER] = { x: cx - dx, y: cy - dy, visibility };
  const hipY = cy + torso;
  lms[LM.LEFT_HIP] = { x: cx + half * 0.8, y: hipY, visibility };
  lms[LM.RIGHT_HIP] = { x: cx - half * 0.8, y: hipY, visibility };
  return lms;
}

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

test('upright pose sits level and scales off shoulder width', () => {
  const t = computeGarmentTransform(pose(), project, FIT, IMAGE);
  assert.ok(t, 'expected a transform');
  assert.equal(Math.round(t.angle * 1e6) / 1e6, 0);
  assert.equal(Math.round(t.shoulderWidth), 200);
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
  const slide = FIT.offsetY * t.shoulderWidth;
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
  assert.equal(computeGarmentTransform(pose().slice(0, 13), project, FIT, IMAGE), null);
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
