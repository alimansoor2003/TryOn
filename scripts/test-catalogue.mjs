/**
 * Checks the garment catalogue and the QR-code routing that depends on it.
 * Run: node scripts/test-catalogue.mjs
 */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GARMENTS, resolveGarment } from '../src/data/garments.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

test('the demo carries exactly three suits, per the PRD', () => {
  assert.equal(GARMENTS.length, 3);
});

test('garment ids are unique', () => {
  assert.equal(new Set(GARMENTS.map((g) => g.id)).size, GARMENTS.length);
});

test('a QR code item_id selects the matching suit', () => {
  for (const g of GARMENTS) {
    const { garment, matched } = resolveGarment(g.id);
    assert.equal(garment.id, g.id);
    assert.equal(matched, true);
  }
});

test('item_id matching tolerates case and stray whitespace', () => {
  const { garment, matched } = resolveGarment('  suit_02  ');
  assert.equal(garment.id, 'SUIT_02');
  assert.equal(matched, true);
});

test('a mis-printed QR code falls back instead of showing a blank screen', () => {
  for (const bad of ['SUIT_99', '', null, undefined]) {
    const { garment, matched } = resolveGarment(bad);
    assert.equal(garment.id, GARMENTS[0].id);
    assert.equal(matched, false);
  }
});

test('every overlay asset referenced by the catalogue exists on disk', () => {
  for (const g of GARMENTS) {
    const file = resolve(ROOT, 'public', g.fit.src.replace(/^\//, ''));
    assert.ok(existsSync(file), `missing overlay for ${g.id}: ${g.fit.src}`);
  }
});

test('fit calibration values are inside sane ranges', () => {
  for (const { id, fit } of GARMENTS) {
    assert.ok(fit.shoulderSpan > 0.2 && fit.shoulderSpan < 1, `${id} shoulderSpan`);
    assert.ok(fit.widthFactor > 0.8 && fit.widthFactor < 2.5, `${id} widthFactor`);
    assert.ok(fit.anchor.y >= 0 && fit.anchor.y <= 1, `${id} anchor.y`);
    assert.ok(Math.abs(fit.offsetY) < 0.5, `${id} offsetY`);
  }
});

test('a garment marked VTON-ready actually has a product photo on disk', () => {
  // Guards the swap-in: flipping product.ready without adding the file would
  // otherwise only fail at request time, in front of a customer.
  for (const g of GARMENTS.filter((g) => g.product.ready)) {
    const file = resolve(ROOT, 'public', g.product.src.replace(/^\//, ''));
    assert.ok(existsSync(file), `${g.id} is marked ready but ${g.product.src} is missing`);
  }
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
