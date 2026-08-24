/**
 * Checks the photo sizing shared by the shutter and the gallery upload. Pure
 * maths, so it runs without a camera or a file picker.
 * Run: node scripts/test-photo.mjs
 */
import assert from 'node:assert/strict';
import { fitDimensions } from '../src/lib/photo.js';

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

test('a portrait phone frame is scaled to fit the long edge', () => {
  const d = fitDimensions(720, 1280, 1024);
  assert.equal(d.height, 1024);
  assert.equal(d.width, 576);
});

test('a landscape webcam frame is scaled on its long edge too', () => {
  const d = fitDimensions(1920, 1080, 1024);
  assert.equal(d.width, 1024);
  assert.equal(d.height, 576);
});

test('aspect ratio is preserved', () => {
  const d = fitDimensions(1280, 960, 1024);
  assert.ok(Math.abs(d.width / d.height - 1280 / 960) < 0.01);
});

test('a frame already under the limit is left alone', () => {
  // Upscaling invents pixels: more upload weight, no more detail, and the model
  // downsamples it again anyway.
  const d = fitDimensions(640, 480, 1024);
  assert.deepEqual([d.width, d.height, d.scale], [640, 480, 1]);
});

test('a frame exactly at the limit is not touched', () => {
  const d = fitDimensions(1024, 768, 1024);
  assert.equal(d.scale, 1);
});

test('a camera that has not reported dimensions yet returns zero', () => {
  // videoWidth is 0 until metadata lands; this must not produce NaN.
  const d = fitDimensions(0, 0, 1024);
  assert.deepEqual([d.width, d.height], [0, 0]);
});

test('a 12MP gallery photo is brought down to the same envelope', () => {
  // Gallery uploads are the big ones: a modern phone photo is 4000x3000 and
  // would be several megabytes of base64 if posted whole.
  const d = fitDimensions(4032, 3024, 1024);
  assert.equal(d.width, 1024);
  assert.ok(d.height < 800);
});

test('the scaled frame stays well inside the request body cap', () => {
  // Vercel rejects bodies over ~4.5MB and the API refuses over 3MB. A 1024px
  // JPEG is a few hundred KB, so this is headroom, not a near miss.
  const d = fitDimensions(3840, 2160, 1024);
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
