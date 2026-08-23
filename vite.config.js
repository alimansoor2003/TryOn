import { cpSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const ROOT = dirname(fileURLToPath(import.meta.url));

/**
 * Serves MediaPipe's WASM runtime from our own origin instead of a CDN.
 *
 * Pointing FilesetResolver at a CDN URL means hardcoding a version string that
 * silently drifts out of step with the installed package on the next `npm
 * install` — the symptom is a 404 and a dead viewfinder, with nothing in the
 * app's own code changed. Copying straight out of node_modules makes the
 * runtime and the JS API the same version by construction, and removes a
 * third-party network dependency from a demo that has to work on shop wifi.
 */
function mediapipeWasm() {
  return {
    name: 'copy-mediapipe-wasm',
    buildStart() {
      const src = resolve(ROOT, 'node_modules/@mediapipe/tasks-vision/wasm');
      if (!existsSync(src)) {
        this.error('@mediapipe/tasks-vision/wasm not found — run `npm install` first.');
      }
      cpSync(src, resolve(ROOT, 'public/mediapipe/wasm'), { recursive: true });
    },
  };
}

export default defineConfig({
  plugins: [mediapipeWasm(), react(), tailwindcss()],
  server: {
    host: true, // expose on the LAN so a phone can reach the dev server
    port: 5173,
  },
  build: {
    target: 'es2022',
  },
});
