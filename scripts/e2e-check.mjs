/** End-to-end check of /api/tryon against the configured provider. */
import { readFileSync, writeFileSync } from 'node:fs';
import handler from '../api/tryon.js';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
for (const [k, v] of Object.entries(env)) process.env[k] ??= v;
process.env.PUBLIC_ORIGIN ??= 'http://localhost:5173';

const person = readFileSync('incoming/white-t.png').toString('base64');

const req = {
  method: 'POST',
  headers: { host: 'localhost:5173' },
  body: {
    itemId: 'TEE_01',
    image: `data:image/png;base64,${person}`,
    aiGarmentUrl: '/garments/tee-black/garment.png',
    category: 'upper_body',
    garment_des:
      'black adidas Adicolor 3-Stripes short sleeve t-shirt with white shoulder stripes and white collar trim',
  },
};

let code = 200;
const res = {
  status(c) { code = c; return this; },
  setHeader() { return this; },
  json(payload) {
    if (payload.error) {
      console.log(`FAIL  HTTP ${code}  ${payload.error.code}`);
      console.log('     ', payload.error.message.slice(0, 240));
      process.exitCode = 1;
      return;
    }
    console.log(`OK    HTTP ${code}`);
    console.log('      provider:', payload.provider);
    console.log('      model:   ', payload.model);
    console.log('      time:    ', (payload.ms / 1000).toFixed(1) + 's');
    console.log('      image:   ', payload.image.slice(0, 32) + '…',
      `(${(payload.image.length * 0.75 / 1024).toFixed(0)}KB)`);
    const b64 = payload.image.slice(payload.image.indexOf(',') + 1);
    writeFileSync('incoming/e2e-result.png', Buffer.from(b64, 'base64'));
    console.log('      saved -> incoming/e2e-result.png');
  },
};
console.log('provider:', process.env.VTON_PROVIDER || '(default)');
await handler(req, res);
