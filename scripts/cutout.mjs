/**
 * Turns a product laydown photo into the two assets a garment needs.
 *
 *   node scripts/cutout.mjs <input> <garment-dir>
 *
 * Produces:
 *   public/garments/<dir>/overlay.png   alpha cutout for the AR overlay
 *   public/garments/<dir>/product.jpg   the original photo, for IDM-VTON
 *
 * Background removal is a border flood fill, not a brightness threshold.
 * These garments carry white stripes and white trim that are as bright as the
 * studio backdrop, so any global threshold punches holes straight through
 * them. Filling inward from the frame edge only removes background that is
 * actually connected to the edge, which leaves interior white intact.
 *
 * Also prints a width profile of the cutout, which is what the fit calibration
 * in src/data/garments.js is derived from.
 */
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const [input, garmentDir] = process.argv.slice(2);
if (!input || !garmentDir) {
  console.error('Usage: node scripts/cutout.mjs <input-image> <garment-dir>');
  process.exit(1);
}

/** How far a pixel may stray from the sampled backdrop and still count as background. */
const TOLERANCE = 42;
/** Pixels shaved off the edge. The backdrop is light and these garments are dark, so a
 *  single row of half-blended edge pixels reads as a bright halo over live video. */
const ERODE_PX = 2;
/** Gaussian applied to the alpha channel only, to undo the hard flood-fill edge. */
const FEATHER = 1.1;

const src = resolve(ROOT, input);
const outDir = resolve(ROOT, 'public', 'garments', garmentDir);
await mkdir(outDir, { recursive: true });

const { data, info } = await sharp(src).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height } = info;
const px = (x, y) => (y * width + x) * 3;

// Sample the backdrop from the frame corners rather than assuming pure white —
// these are shot on a light grey seamless, not on #ffffff.
const samples = [];
for (const [sx, sy] of [[2, 2], [width - 3, 2], [2, height - 3], [width - 3, height - 3]]) {
  const i = px(sx, sy);
  samples.push([data[i], data[i + 1], data[i + 2]]);
}
const bg = [0, 1, 2].map((c) => Math.round(samples.reduce((s, v) => s + v[c], 0) / samples.length));

const isBackdrop = (x, y) => {
  const i = px(x, y);
  const dr = data[i] - bg[0];
  const dg = data[i + 1] - bg[1];
  const db = data[i + 2] - bg[2];
  return Math.sqrt(dr * dr + dg * dg + db * db) <= TOLERANCE;
};

// Flood fill inward from every border pixel.
const background = new Uint8Array(width * height);
const stack = [];
for (let x = 0; x < width; x++) {
  stack.push(x, 0, x, height - 1);
}
for (let y = 0; y < height; y++) {
  stack.push(0, y, width - 1, y);
}
while (stack.length) {
  const y = stack.pop();
  const x = stack.pop();
  if (x < 0 || y < 0 || x >= width || y >= height) continue;
  const k = y * width + x;
  if (background[k] || !isBackdrop(x, y)) continue;
  background[k] = 1;
  stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
}

// Erode the garment edge inward.
let alpha = new Uint8Array(width * height);
for (let i = 0; i < alpha.length; i++) alpha[i] = background[i] ? 0 : 255;

for (let pass = 0; pass < ERODE_PX; pass++) {
  const next = Uint8Array.from(alpha);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const k = y * width + x;
      if (!alpha[k]) continue;
      if (!alpha[k - 1] || !alpha[k + 1] || !alpha[k - width] || !alpha[k + width]) next[k] = 0;
    }
  }
  alpha = next;
}

// toColourspace('b-w') is load-bearing: without it sharp hands back a
// 3-channel buffer for a 1-channel input, and reading that with a stride of 1
// yields a diagonally smeared mask rather than an obvious error.
const blurred = await sharp(Buffer.from(alpha), { raw: { width, height, channels: 1 } })
  .blur(FEATHER)
  .toColourspace('b-w')
  .raw()
  .toBuffer({ resolveWithObject: true });

if (blurred.info.channels !== 1) {
  throw new Error(`expected a single-channel alpha, got ${blurred.info.channels}`);
}
const softAlpha = blurred.data;

// Recombine into RGBA.
const rgba = Buffer.alloc(width * height * 4);
for (let k = 0; k < width * height; k++) {
  rgba[k * 4] = data[k * 3];
  rgba[k * 4 + 1] = data[k * 3 + 1];
  rgba[k * 4 + 2] = data[k * 3 + 2];
  rgba[k * 4 + 3] = softAlpha[k];
}

// Crop to the garment's own bounds so the fit anchors mean something. A cutout
// keeping the studio's framing would make every calibration number a function
// of how much empty space the photographer left.
let minX = width;
let maxX = -1;
let minY = height;
let maxY = -1;
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    if (softAlpha[y * width + x] > 16) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
}
if (maxX < 0) {
  console.error('Nothing survived the cutout — the backdrop may not be uniform.');
  process.exit(1);
}

const cropW = maxX - minX + 1;
const cropH = maxY - minY + 1;

await sharp(rgba, { raw: { width, height, channels: 4 } })
  .extract({ left: minX, top: minY, width: cropW, height: cropH })
  .png({ compressionLevel: 9 })
  .toFile(resolve(outDir, 'overlay.png'));

// IDM-VTON wants the ordinary photograph, backdrop and all.
await sharp(src).jpeg({ quality: 92 }).toFile(resolve(outDir, 'product.jpg'));

// Width profile of the cropped cutout, used to derive `span` and `anchor.y`.
console.log(`\nbackdrop rgb(${bg.join(',')})  source ${width}x${height}`);
console.log(`cutout  ${cropW}x${cropH}  (cropped from ${minX},${minY})`);
console.log('\n  y%     left%   right%   width%');
for (let p = 0; p <= 100; p += 5) {
  const y = Math.min(cropH - 1, Math.round((p / 100) * (cropH - 1)));
  let lo = cropW;
  let hi = -1;
  for (let x = 0; x < cropW; x++) {
    if (softAlpha[(y + minY) * width + (x + minX)] > 128) {
      if (x < lo) lo = x;
      if (x > hi) hi = x;
    }
  }
  const fmt = (v) => (v * 100).toFixed(1).padStart(6);
  if (hi < 0) console.log(`${String(p).padStart(4)}%       --       --       --`);
  else console.log(`${String(p).padStart(4)}% ${fmt(lo / cropW)} ${fmt(hi / cropW)} ${fmt((hi - lo + 1) / cropW)}`);
}
console.log(`\nwrote public/garments/${garmentDir}/overlay.png and product.jpg`);
