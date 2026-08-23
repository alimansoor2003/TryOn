/**
 * Emits stand-in suit overlays so the AR pipeline is demoable before real
 * product cutouts arrive. Run with: node scripts/generate-placeholders.mjs
 *
 * These are SVGs with explicit intrinsic dimensions, which canvas drawImage()
 * handles exactly like a PNG. Replace them with real alpha-cut PNGs and update
 * `fit.src` in src/data/garments.js — nothing else needs to change.
 *
 * The geometry here defines the calibration baked into garments.js:
 *   shoulder seams at x = 190 and x = 810  ->  shoulderSpan = 0.62
 *   shoulder line  at y = 266              ->  anchor.y     = 0.19
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const W = 1000;
const H = 1400;
const SHOULDER_L = 190;
const SHOULDER_R = 810;
const SHOULDER_Y = 266;

const suits = [
  { dir: 'suit-01', cloth: '#1e2a44', shade: '#141d31', shirt: '#f2f4f8', tie: '#8c2f39' },
  { dir: 'suit-02', cloth: '#3c3f45', shade: '#2a2c31', shirt: '#eef1f5', tie: '#2f5d62' },
  { dir: 'suit-03', cloth: '#5a4632', shade: '#40321f', shirt: '#f6f1e7', tie: '#243447' },
];

const svg = ({ cloth, shade, shirt, tie }) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <g>
    <!-- left sleeve -->
    <path d="M ${SHOULDER_L} ${SHOULDER_Y} C 110 320 78 470 70 700 C 64 900 82 1030 104 1120 L 236 1120 C 224 1010 220 880 226 740 Z" fill="${shade}"/>
    <!-- right sleeve -->
    <path d="M ${SHOULDER_R} ${SHOULDER_Y} C 890 320 922 470 930 700 C 936 900 918 1030 896 1120 L 764 1120 C 776 1010 780 880 774 740 Z" fill="${shade}"/>
    <!-- jacket body -->
    <path d="M ${SHOULDER_L} ${SHOULDER_Y} C 300 226 380 210 500 210 C 620 210 700 226 ${SHOULDER_R} ${SHOULDER_Y} C 792 420 786 700 780 900 C 776 1040 768 1150 758 1240 L 242 1240 C 232 1150 224 1040 220 900 C 214 700 208 420 ${SHOULDER_L} ${SHOULDER_Y} Z" fill="${cloth}"/>
    <!-- shirt V -->
    <path d="M 410 232 L 500 232 L 590 232 L 566 470 L 500 620 L 434 470 Z" fill="${shirt}"/>
    <!-- tie -->
    <path d="M 500 250 L 542 300 L 520 470 L 500 596 L 480 470 L 458 300 Z" fill="${tie}"/>
    <!-- left lapel -->
    <path d="M 402 224 L 470 232 L 496 616 L 320 470 C 330 380 356 290 402 224 Z" fill="${cloth}" stroke="${shade}" stroke-width="6"/>
    <!-- right lapel -->
    <path d="M 598 224 L 530 232 L 504 616 L 680 470 C 670 380 644 290 598 224 Z" fill="${cloth}" stroke="${shade}" stroke-width="6"/>
    <!-- buttons -->
    <circle cx="500" cy="700" r="15" fill="${shade}"/>
    <circle cx="500" cy="800" r="15" fill="${shade}"/>
  </g>
</svg>
`;

for (const suit of suits) {
  const out = resolve(ROOT, 'public', 'garments', suit.dir, 'overlay.svg');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, svg(suit), 'utf8');
  console.log('wrote', out.slice(ROOT.length + 1));
}
