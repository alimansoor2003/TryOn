/**
 * Turns a product photo into the assets a garment needs.
 *
 *   node scripts/cutout.mjs <input> <garment-dir> [options]
 *
 * Produces, in public/garments/<garment-dir>/:
 *   overlay.png   alpha cutout, cropped to the garment — the AR overlay
 *   garment.png   cutout on white, padded to a centred 3:4 — the IDM-VTON input
 *   product.jpg   the untouched source photo, kept for reference
 *
 * Why garment.png is shaped the way it is: IDM-VTON is trained on VITON-HD,
 * whose garment images are 768x1024 (3:4) flat-lays on white. Handing it a
 * different aspect ratio or a grey studio backdrop pushes the input off the
 * distribution the model learned, which shows up as warped or discoloured
 * output. Normalising here is cheaper and far more predictable than trying to
 * correct it after generation.
 *
 * Background removal is a border flood fill, not a brightness threshold. These
 * garments carry white stripes and white trim as bright as the studio backdrop,
 * so any global threshold punches holes straight through them. Filling inward
 * from the frame edge only removes background actually connected to the edge.
 *
 * Options:
 *   --tolerance=N   colour distance still counted as backdrop. Defaults to a
 *                   value derived from the backdrop's own measured variance —
 *                   raise it only if backdrop survives the fill, and check the
 *                   result, because too high silently eats white trim
 *   --dehanger=N    strip appendages thinner than ~2N px: hanger hooks, straps,
 *                   clip marks. 0 disables (default 0)
 *   --despeckle=F   drop blobs smaller than this fraction of the frame
 *                   (default 0.0002)
 *   --margin=F      white border around the garment in garment.png (default 0.06)
 *   --no-cutout     skip background removal for garment.png and just pad the
 *                   original photo — use when the cutout misfires
 */
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith('--'));
const flag = (name, fallback) => {
  const hit = args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  const [, value] = hit.split('=');
  return value === undefined ? true : Number(value);
};

const [input, garmentDir] = positional;
if (!input || !garmentDir) {
  console.error('Usage: node scripts/cutout.mjs <input-image> <garment-dir> [--tolerance=42] [--dehanger=0] [--margin=0.06] [--no-cutout]');
  process.exit(1);
}

const TOLERANCE_OVERRIDE = flag('tolerance', null);
const DEHANGER = Number(flag('dehanger', 0));
const MARGIN = Number(flag('margin', 0.06));
/** Blobs below this fraction of the frame are treated as noise, not garment. */
const DESPECKLE = Number(flag('despeckle', 0.0002));
const SKIP_CUTOUT = args.includes('--no-cutout');

/** Pixels shaved off the edge. The backdrop is light and these garments are dark,
 *  so a single row of half-blended edge pixels reads as a bright halo. */
const ERODE_PX = 2;
/** Pre-cut sources need no shaving; anything above 0 eats real garment. */
const ERODE_SOURCE_ALPHA = 0;
/** Gaussian applied to the alpha channel only, to soften the flood fill's hard edge. */
const FEATHER = 1.1;
/** VITON-HD's native garment resolution, which is what IDM-VTON expects. */
const VTON_W = 768;
const VTON_H = 1024;

const src = resolve(ROOT, input);
const outDir = resolve(ROOT, 'public', 'garments', garmentDir);
await mkdir(outDir, { recursive: true });

// Read RGBA, not RGB. Plenty of catalogue images arrive already cut out, and
// throwing the alpha away would force a colour-based removal that cannot work
// on them — a white tee on a transparent background becomes a white tee on
// black, and the fill eats whichever one it decides is the backdrop.
const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height } = info;
const CH = info.channels;
const N = width * height;
const px = (x, y) => (y * width + x) * CH;

// Does the source already carry a usable cutout?
let sourceTransparent = 0;
for (let k = 0; k < N; k++) if (data[k * CH + 3] < 8) sourceTransparent++;
const HAS_SOURCE_ALPHA = sourceTransparent / N > 0.02;

// --- backdrop detection ----------------------------------------------------
// Sample every border pixel and take the median rather than assuming white or
// reading a single corner. A vignette or a seamless sweep makes the corners
// differ from the mid-edges, and one unlucky corner sample poisons the whole
// fill.
const collect = [[], [], []];
const sampleAt = (x, y) => {
  const i = px(x, y);
  collect[0].push(data[i]);
  collect[1].push(data[i + 1]);
  collect[2].push(data[i + 2]);
};
for (let x = 0; x < width; x += 4) {
  sampleAt(x, 1);
  sampleAt(x, height - 2);
}
for (let y = 0; y < height; y += 4) {
  sampleAt(1, y);
  sampleAt(width - 2, y);
}
const median = (arr) => {
  const s = Float64Array.from(arr).sort();
  return Math.round(s[Math.floor(s.length / 2)]);
};
const bg = collect.map(median);

// --- tolerance -------------------------------------------------------------
// Derived from how much the backdrop actually varies, not hardcoded.
//
// This matters more than it looks. On these photos the white collar trim is
// rgb(238,235,238) against a backdrop of rgb(234,238,239) — a distance of 5.1.
// Any tolerance above that eats the collar, and because the white stripes run
// from the collar out to the sleeve cuff where they meet the backdrop, the fill
// enters at the cuff and travels up, punching the whole ring out. A generous
// tolerance of 42 destroyed it silently: the collar is too small a fraction of
// the frame to show up as a change in total foreground.
//
// The backdrop, being a clean studio sweep, has essentially zero variance, so a
// tight tolerance removes all of it. Scaling off the measured spread keeps that
// safe on a less even backdrop without hand-tuning per photo.
const spread = [];
for (let x = 0; x < width; x += 7) {
  for (const y of [3, height - 4]) {
    const i = px(x, y);
    spread.push(Math.hypot(data[i] - bg[0], data[i + 1] - bg[1], data[i + 2] - bg[2]));
  }
}
for (let y = 0; y < height; y += 7) {
  for (const x of [3, width - 4]) {
    const i = px(x, y);
    spread.push(Math.hypot(data[i] - bg[0], data[i + 1] - bg[1], data[i + 2] - bg[2]));
  }
}
spread.sort((a, b) => a - b);
const p99 = spread[Math.floor(spread.length * 0.99)];
const TOLERANCE =
  TOLERANCE_OVERRIDE === null
    ? Math.min(20, Math.max(4, Math.round(p99 * 2 + 4)))
    : Number(TOLERANCE_OVERRIDE);

const tol2 = TOLERANCE * TOLERANCE;
const isBackdrop = (idx) => {
  const i = idx * CH;
  const dr = data[i] - bg[0];
  const dg = data[i + 1] - bg[1];
  const db = data[i + 2] - bg[2];
  return dr * dr + dg * dg + db * db <= tol2;
};

// --- flood fill inward from the frame edge ---------------------------------
const background = new Uint8Array(N);
const queue = new Int32Array(N);
let head = 0;
let tail = 0;
const seed = (idx) => {
  if (!background[idx] && isBackdrop(idx)) {
    background[idx] = 1;
    queue[tail++] = idx;
  }
};
for (let x = 0; x < width; x++) {
  seed(x);
  seed((height - 1) * width + x);
}
for (let y = 0; y < height; y++) {
  seed(y * width);
  seed(y * width + width - 1);
}
while (head < tail) {
  const idx = queue[head++];
  const x = idx % width;
  const y = (idx / width) | 0;
  if (x > 0) seed(idx - 1);
  if (x < width - 1) seed(idx + 1);
  if (y > 0) seed(idx - width);
  if (y < height - 1) seed(idx + width);
}

let mask = new Uint8Array(N);
if (HAS_SOURCE_ALPHA) {
  // Trust the alpha that shipped with the file. It was made by whoever
  // photographed the garment and is better than anything inferred from colour.
  for (let i = 0; i < N; i++) mask[i] = data[i * CH + 3] >= 128 ? 1 : 0;
} else {
  for (let i = 0; i < N; i++) mask[i] = background[i] ? 0 : 1;
}

// --- morphology ------------------------------------------------------------
function erode(src, passes) {
  let cur = src;
  for (let p = 0; p < passes; p++) {
    const next = Uint8Array.from(cur);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const k = y * width + x;
        if (!cur[k]) continue;
        if (!cur[k - 1] || !cur[k + 1] || !cur[k - width] || !cur[k + width]) next[k] = 0;
      }
    }
    cur = next;
  }
  return cur;
}

function dilate(src, passes) {
  let cur = src;
  for (let p = 0; p < passes; p++) {
    const next = Uint8Array.from(cur);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const k = y * width + x;
        if (cur[k]) continue;
        if (cur[k - 1] || cur[k + 1] || cur[k - width] || cur[k + width]) next[k] = 1;
      }
    }
    cur = next;
  }
  return cur;
}

/**
 * Drops connected blobs smaller than `minPixels`.
 *
 * Deliberately NOT "keep the largest blob". A garment routinely segments into
 * several legitimate pieces — on the tee here, the back of the collar showing
 * above the neckline and the outer edge of one sleeve come out as separate
 * components, together about 1.6% of the foreground. Keeping only the largest
 * silently deletes the collar and part of a sleeve, and it does so at every
 * tolerance, so there is no threshold that makes that approach safe.
 */
function despeckle(src, minPixels) {
  const seen = new Uint8Array(N);
  const out = new Uint8Array(N);
  const q = new Int32Array(N);
  let dropped = 0;
  let droppedPixels = 0;
  for (let start = 0; start < N; start++) {
    if (!src[start] || seen[start]) continue;
    let h = 0;
    let t = 0;
    q[t++] = start;
    seen[start] = 1;
    const members = [];
    while (h < t) {
      const idx = q[h++];
      members.push(idx);
      const x = idx % width;
      const y = (idx / width) | 0;
      const push = (n) => {
        if (src[n] && !seen[n]) {
          seen[n] = 1;
          q[t++] = n;
        }
      };
      if (x > 0) push(idx - 1);
      if (x < width - 1) push(idx + 1);
      if (y > 0) push(idx - width);
      if (y < height - 1) push(idx + width);
    }
    if (members.length >= minPixels) {
      for (const idx of members) out[idx] = 1;
    } else {
      dropped++;
      droppedPixels += members.length;
    }
  }
  return { mask: out, dropped, droppedPixels };
}

// Specks that survive the flood fill because they are not connected to the frame
// edge: sensor noise, dust on the sweep, compression artefacts, small patches of
// floor texture.
const speckled = despeckle(mask, Math.round(N * DESPECKLE));
mask = speckled.mask;

// A hanger hook is connected to the garment, so no component filter can touch
// it. Opening — erode, then dilate back — severs anything thinner than the
// structuring element while leaving the garment's own edges where they were.
// Every blob surviving the erosion is bulk by definition, so they are all kept;
// filtering to the largest here would delete the collar all over again.
let removedThin = 0;
if (DEHANGER > 0) {
  const opened = dilate(erode(mask, DEHANGER), DEHANGER);
  const intersected = new Uint8Array(N);
  let n = 0;
  for (let i = 0; i < N; i++) {
    intersected[i] = mask[i] && opened[i] ? 1 : 0;
    if (mask[i] && !intersected[i]) n++;
  }
  mask = intersected;
  removedThin = n;
}

// Erosion exists to shave the halo of blended backdrop pixels the flood fill
// leaves behind. A source that arrived already cut out has no such halo, so
// eroding it would just eat 2px of real garment.
mask = erode(mask, HAS_SOURCE_ALPHA ? ERODE_SOURCE_ALPHA : ERODE_PX);

// --- alpha channel ---------------------------------------------------------
const hard = new Uint8Array(N);
for (let i = 0; i < N; i++) hard[i] = mask[i] ? 255 : 0;

// toColourspace('b-w') is load-bearing: without it sharp hands back a
// 3-channel buffer for a 1-channel input, and reading that with a stride of 1
// yields a diagonally smeared mask rather than an obvious error.
const blurred = await sharp(Buffer.from(hard), { raw: { width, height, channels: 1 } })
  .blur(FEATHER)
  .toColourspace('b-w')
  .raw()
  .toBuffer({ resolveWithObject: true });
if (blurred.info.channels !== 1) {
  throw new Error(`expected a single-channel alpha, got ${blurred.info.channels}`);
}
const alpha = blurred.data;

const rgba = Buffer.alloc(N * 4);
for (let k = 0; k < N; k++) {
  rgba[k * 4] = data[k * CH];
  rgba[k * 4 + 1] = data[k * CH + 1];
  rgba[k * 4 + 2] = data[k * CH + 2];
  rgba[k * 4 + 3] = alpha[k];
}

// --- crop to the garment ---------------------------------------------------
// A cutout keeping the studio's framing would make every calibration number a
// function of how much empty space the photographer left.
let minX = width;
let maxX = -1;
let minY = height;
let maxY = -1;
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    if (alpha[y * width + x] > 16) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
}
if (maxX < 0) {
  console.error('Nothing survived the cutout — the backdrop may not be uniform enough.');
  console.error('Try a larger --tolerance, or --no-cutout to skip removal for garment.png.');
  process.exit(1);
}
const cropW = maxX - minX + 1;
const cropH = maxY - minY + 1;

const cutout = await sharp(rgba, { raw: { width, height, channels: 4 } })
  .extract({ left: minX, top: minY, width: cropW, height: cropH })
  .png({ compressionLevel: 9 })
  .toBuffer();

await sharp(cutout).toFile(resolve(outDir, 'overlay.png'));

// --- VTON input: centred on white, 3:4 -------------------------------------
const boxW = Math.round(VTON_W * (1 - 2 * MARGIN));
const boxH = Math.round(VTON_H * (1 - 2 * MARGIN));
const source = SKIP_CUTOUT ? await sharp(src).removeAlpha().png().toBuffer() : cutout;

const scaled = await sharp(source)
  .resize({ width: boxW, height: boxH, fit: 'inside', withoutEnlargement: false })
  .toBuffer({ resolveWithObject: true });

await sharp({
  create: { width: VTON_W, height: VTON_H, channels: 3, background: '#ffffff' },
})
  .composite([
    {
      input: scaled.data,
      left: Math.round((VTON_W - scaled.info.width) / 2),
      top: Math.round((VTON_H - scaled.info.height) / 2),
    },
  ])
  .png()
  .toFile(resolve(outDir, 'garment.png'));

await sharp(src).jpeg({ quality: 92 }).toFile(resolve(outDir, 'product.jpg'));

// --- report ----------------------------------------------------------------
const pct = (n) => ((n / N) * 100).toFixed(2);
if (HAS_SOURCE_ALPHA) {
  console.log(
    `\nsource ${width}x${height} arrived with an alpha channel ` +
      `(${((sourceTransparent / N) * 100).toFixed(1)}% transparent) — honoured as-is, no colour removal`,
  );
} else {
  console.log(
    `\nbackdrop rgb(${bg.join(',')}) spread p99 ${p99.toFixed(1)}  source ${width}x${height}  ` +
      `tolerance ${TOLERANCE}${TOLERANCE_OVERRIDE === null ? ' (auto)' : ' (override)'}`,
  );
}
if (speckled.dropped) console.log(`dropped ${speckled.dropped} speck(s), ${pct(speckled.droppedPixels)}% of frame`);
if (removedThin) console.log(`removed ${pct(removedThin)}% thin appendages (--dehanger=${DEHANGER})`);
console.log(`cutout  ${cropW}x${cropH}  (cropped from ${minX},${minY})`);
console.log(`vton    ${VTON_W}x${VTON_H}  garment scaled to ${scaled.info.width}x${scaled.info.height} on white`);

console.log('\n  y%     left%   right%   width%');
for (let p = 0; p <= 100; p += 5) {
  const y = Math.min(cropH - 1, Math.round((p / 100) * (cropH - 1)));
  let lo = cropW;
  let hi = -1;
  for (let x = 0; x < cropW; x++) {
    if (alpha[(y + minY) * width + (x + minX)] > 128) {
      if (x < lo) lo = x;
      if (x > hi) hi = x;
    }
  }
  const fmt = (v) => (v * 100).toFixed(1).padStart(6);
  if (hi < 0) console.log(`${String(p).padStart(4)}%       --       --       --`);
  else console.log(`${String(p).padStart(4)}% ${fmt(lo / cropW)} ${fmt(hi / cropW)} ${fmt((hi - lo + 1) / cropW)}`);
}
console.log(`\nwrote public/garments/${garmentDir}/{overlay.png, garment.png, product.jpg}`);
