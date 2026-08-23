import { cpSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
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

/**
 * Runs the Vercel serverless functions inside the Vite dev server.
 *
 * Without this, `npm run dev` serves the front end but not /api, and Vite's SPA
 * fallback answers the POST with index.html and a 200 — so the client gets a
 * JSON parse failure on an apparently successful request, which is about the
 * most misleading way that could fail. Deploying just to click a button is also
 * a miserable loop.
 *
 * The shim is deliberately minimal: Vercel's Node runtime hands the handler a
 * plain req/res plus `req.body`, `res.status()` and `res.json()`, and that is
 * all api/tryon.js touches.
 */
function apiDevServer(mode) {
  // Serverless functions read secrets straight off process.env. Vite only
  // exposes VITE_-prefixed vars to the client, and nothing to Node, so the
  // token has to be loaded in explicitly or the handler 500s locally.
  const env = loadEnv(mode, process.cwd(), '');
  for (const [key, value] of Object.entries(env)) {
    if (!(key in process.env)) process.env[key] = value;
  }

  return {
    name: 'api-dev-server',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next();

        const route = req.url.split('?')[0].replace(/^\/api\//, '');
        const modulePath = `/api/${route}.js`;

        try {
          const chunks = [];
          let size = 0;
          for await (const chunk of req) {
            size += chunk.length;
            // Vercel caps a request body around 4.5MB; refusing here keeps dev
            // behaviour honest instead of accepting what production rejects.
            if (size > 5 * 1024 * 1024) {
              res.statusCode = 413;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: { code: 'payload_too_large', message: 'Body exceeds 5MB.' } }));
              return;
            }
            chunks.push(chunk);
          }
          const raw = Buffer.concat(chunks).toString('utf8');
          req.body = raw ? JSON.parse(raw) : {};

          res.status = (code) => {
            res.statusCode = code;
            return res;
          };
          res.json = (payload) => {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(payload));
            return res;
          };

          const mod = await server.ssrLoadModule(modulePath);
          await mod.default(req, res);
        } catch (err) {
          server.config.logger.error(`[api-dev] ${modulePath}: ${err.message}`);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              error: { code: 'dev_handler_failed', message: err.message },
            }),
          );
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [mediapipeWasm(), apiDevServer(mode), react(), tailwindcss()],
  server: {
    host: true, // expose on the LAN so a phone can reach the dev server
    port: 5173,
  },
  build: {
    target: 'es2022',
  },
}));
