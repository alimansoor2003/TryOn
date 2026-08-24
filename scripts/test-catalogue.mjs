/**
 * Checks the garment catalogue and the QR-code routing that depends on it.
 * Run: node scripts/test-catalogue.mjs
 */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { GARMENTS, resolveGarment } from '../src/data/garments.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

test('the catalogue is non-empty and small enough to preload', () => {
  // The PRD says three hardcoded items; the demo currently ships the two real
  // garments that have photography. The cap is what matters — every overlay is
  // decoded up front.
  assert.ok(GARMENTS.length >= 1 && GARMENTS.length <= 5, `got ${GARMENTS.length}`);
});

test('every garment declares a category IDM-VTON accepts', () => {
  for (const g of GARMENTS) {
    assert.ok(
      ['upper_body', 'lower_body', 'dresses'].includes(g.category),
      `${g.id} category: ${g.category}`,
    );
  }
});

test('every garment has a description worth conditioning on', () => {
  // IDM-VTON conditions on garment_des. "a shirt" measurably weakens the
  // result against one naming colour, sleeve length and details.
  for (const g of GARMENTS) {
    assert.ok(g.garment_des?.length > 20, `${g.id} description is too thin: "${g.garment_des}"`);
  }
});

test('garment ids are unique', () => {
  assert.equal(new Set(GARMENTS.map((g) => g.id)).size, GARMENTS.length);
});

test('a QR code item_id selects the matching garment', () => {
  for (const g of GARMENTS) {
    const { garment, matched } = resolveGarment(g.id);
    assert.equal(garment.id, g.id);
    assert.equal(matched, true);
  }
});

test('item_id matching tolerates case and stray whitespace', () => {
  const target = GARMENTS[GARMENTS.length - 1].id;
  const { garment, matched } = resolveGarment(`  ${target.toLowerCase()}  `);
  assert.equal(garment.id, target);
  assert.equal(matched, true);
});

test('a mis-printed QR code falls back instead of showing a blank screen', () => {
  for (const bad of ['NOPE_99', '', null, undefined]) {
    const { garment, matched } = resolveGarment(bad);
    assert.equal(garment.id, GARMENTS[0].id);
    assert.equal(matched, false);
  }
});

test('every carousel thumbnail exists on disk', () => {
  for (const g of GARMENTS) {
    const file = resolve(ROOT, 'public', g.thumb.replace(/^\//, ''));
    assert.ok(existsSync(file), `missing thumbnail for ${g.id}: ${g.thumb}`);
  }
});

test('a garment marked ready actually has its VTON asset on disk', () => {
  // Guards the swap-in: flipping `ready` without adding the file would
  // otherwise only fail at request time, in front of a customer.
  for (const g of GARMENTS.filter((g) => g.ready)) {
    const file = resolve(ROOT, 'public', g.aiGarmentUrl.replace(/^\//, ''));
    assert.ok(existsSync(file), `${g.id} is marked ready but ${g.aiGarmentUrl} is missing`);
  }
});

test('every VTON asset is a centred 3:4 image on white', async () => {
  // IDM-VTON is trained on VITON-HD's 768x1024 white-background garment images.
  // Feeding it a square photo on a grey studio sweep is the most likely cause
  // of warped or discoloured output, and nothing at runtime would flag it —
  // the request succeeds and just returns a worse picture.
  for (const g of GARMENTS.filter((g) => g.ready)) {
    const file = resolve(ROOT, 'public', g.aiGarmentUrl.replace(/^\//, ''));
    const img = sharp(file);
    const meta = await img.metadata();

    const ratio = meta.width / meta.height;
    assert.ok(
      Math.abs(ratio - 0.75) < 0.005,
      `${g.id}: aspect ${ratio.toFixed(4)}, expected 0.75 (3:4)`,
    );

    // Corners must be white, which is what proves the pad actually happened
    // rather than the source being cropped to ratio.
    const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
    const corners = [
      [2, 2],
      [meta.width - 3, 2],
      [2, meta.height - 3],
      [meta.width - 3, meta.height - 3],
    ];
    for (const [x, y] of corners) {
      const i = (y * info.width + x) * info.channels;
      const [r, gr, b] = [data[i], data[i + 1], data[i + 2]];
      assert.ok(
        r > 248 && gr > 248 && b > 248,
        `${g.id}: corner (${x},${y}) is rgb(${r},${gr},${b}), expected white`,
      );
    }
  }
});

let failed = 0;
for (const [name, fn] of tests) {
  try {
    await fn();
    console.log(`  PASS  ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`  FAIL  ${name}\n        ${err.message}`);
  }
}
console.log(`\n${tests.length - failed}/${tests.length} passed`);
process.exit(failed ? 1 : 0);
