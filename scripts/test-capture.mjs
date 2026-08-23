/**
 * Checks the frame-capture sizing. Pure maths, so it runs without a camera.
 * Run: node scripts/test-capture.mjs
 */
import assert from 'node:assert/strict';
import { captureDimensions } from '../src/lib/capture.js';

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

test('a portrait phone frame is scaled to fit the long edge', () => {
  const d = captureDimensions(720, 1280, 1024);
  assert.equal(d.height, 1024);
  assert.equal(d.width, 576);
});

test('a landscape webcam frame is scaled on its long edge too', () => {
  const d = captureDimensions(1920, 1080, 1024);
  assert.equal(d.width, 1024);
  assert.equal(d.height, 576);
});

test('aspect ratio is preserved', () => {
  const d = captureDimensions(1280, 960, 1024);
  assert.ok(Math.abs(d.width / d.height - 1280 / 960) < 0.01);
});

test('a frame already under the limit is left alone', () => {
  // Upscaling invents pixels: more upload weight, no more detail, and the model
  // downsamples it again anyway.
  const d = captureDimensions(640, 480, 1024);
  assert.deepEqual([d.width, d.height, d.scale], [640, 480, 1]);
});

test('a frame exactly at the limit is not touched', () => {
  const d = captureDimensions(1024, 768, 1024);
  assert.equal(d.scale, 1);
});

test('a camera that has not reported dimensions yet returns zero', () => {
  // videoWidth is 0 until metadata lands; this must not produce NaN.
  const d = captureDimensions(0, 0, 1024);
  assert.deepEqual([d.width, d.height], [0, 0]);
});

test('the scaled frame stays well inside the request body cap', () => {
  // Vercel rejects bodies over ~4.5MB and the API refuses over 3MB. A 1024px
  // JPEG is a few hundred KB, so this is headroom, not a near miss.
  const d = captureDimensions(3840, 2160, 1024);
  assert.ok(d.width * d.height <= 1024 * 1024, `${d.width}x${d.height} is too large`);
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
