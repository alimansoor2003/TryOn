/**
 * Prints the in-store QR codes, one per suit.
 *
 *   npm run qr -- https://your-app.vercel.app
 *
 * Writes PNGs to ./qr-codes/ and also renders each one in the terminal so you
 * can scan straight off the screen while testing.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';
import { GARMENTS } from '../src/data/garments.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const base = process.argv[2];

if (!base) {
  console.error('Usage: npm run qr -- https://your-app.vercel.app');
  process.exit(1);
}

const outDir = resolve(ROOT, 'qr-codes');
await mkdir(outDir, { recursive: true });

for (const garment of GARMENTS) {
  const url = new URL('/', base);
  url.searchParams.set('item_id', garment.id);
  const target = url.toString();

  const file = resolve(outDir, `${garment.id}.png`);
  await QRCode.toFile(file, target, {
    width: 900,
    margin: 2,
    // High correction: these get printed small and stuck on a garment tag that
    // creases, and a scan that fails in front of a customer kills the demo.
    errorCorrectionLevel: 'H',
  });

  console.log(`\n${garment.id} — ${garment.name}\n${target}`);
  console.log(await QRCode.toString(target, { type: 'terminal', small: true }));
  console.log(`saved qr-codes/${garment.id}.png`);
}
