/**
 * Downloads the pose model into public/mediapipe so the demo has no runtime
 * dependency on Google's CDN.
 *
 *   npm run vendor:model
 *   echo "VITE_MODEL_BASE=/mediapipe" >> .env.local
 *
 * The WASM runtime is already served locally — vite.config.js copies it out of
 * node_modules automatically, so this script only needs the weights (~4MB).
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'public', 'mediapipe');
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

await mkdir(OUT, { recursive: true });

const res = await fetch(MODEL_URL);
if (!res.ok) throw new Error(`model download failed: ${res.status} ${res.statusText}`);

const bytes = Buffer.from(await res.arrayBuffer());
await writeFile(resolve(OUT, 'pose_landmarker_lite.task'), bytes);

console.log(`downloaded pose_landmarker_lite.task (${(bytes.length / 1024 / 1024).toFixed(1)}MB)`);
console.log('\nNow add this to .env.local:\n  VITE_MODEL_BASE=/mediapipe');
