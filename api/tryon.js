import { GARMENTS } from '../src/data/garments.js';
import * as gemini from './providers/gemini.js';
import * as huggingface from './providers/huggingface.js';
import * as replicate from './providers/replicate.js';

/**
 * POST /api/tryon
 *
 * Body: {
 *   itemId:       string,   // catalogue id
 *   image:        string,   // the person, as a data URL or bare base64
 *   aiGarmentUrl: string,   // optional, must match the catalogue entry
 *   category:     string,   // optional, must match
 *   garment_des:  string,   // optional, must match
 * }
 * 200: { image: string, provider: string, model: string, ms: number }
 *
 * The client sends the garment fields explicitly, but they are treated as a
 * claim to be checked rather than as instructions. `aiGarmentUrl` in particular
 * becomes a URL this server fetches: taking it on trust would let anyone POST an
 * internal address and have the server retrieve it for them. So the garment is
 * resolved from `itemId` server-side, and a mismatch is rejected rather than
 * quietly preferring one source over the other.
 *
 * Runs on Vercel's Node runtime rather than Edge: the model call routinely
 * outruns the Edge limit, and vercel.json gives this function 60s.
 */

const PROVIDERS = { huggingface, gemini, replicate };

/**
 * Free by default, and the only option that is actually free as of writing.
 * Google moved image generation off the Gemini free tier (it reports
 * `limit: 0`), and Replicate needs a payment method. The Hugging Face Space runs
 * the same IDM-VTON model Replicate charges for.
 */
const DEFAULT_PROVIDER = 'huggingface';

// Vercel caps a serverless request body at ~4.5MB. A base64 payload is ~1.33x
// the raw bytes, so anything over this is rejected by the platform before our
// code runs — check first so the client gets a useful message, not an opaque 413.
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

const jsonError = (res, status, code, message) =>
  res.status(status).json({ error: { code, message } });

/**
 * Turns a relative asset path into an absolute URL the provider can fetch.
 *
 * The scheme has to match reality or the fetch fails outright — TLS on a plain
 * HTTP port doesn't downgrade, it errors with ERR_SSL_WRONG_VERSION_NUMBER. In
 * local dev `req.headers.host` is `localhost:5173` served over plain HTTP, so
 * hardcoding `https://` here built a URL the server could never actually reach:
 * every /api/tryon call failed with a bare "fetch failed" and no indication why.
 * Vercel's own req carries `x-forwarded-proto: https`, which is used when
 * present; local dev has no such header, so it falls back to matching whatever
 * protocol Node itself is speaking (TLS socket present = https).
 */
function absoluteUrl(path, req) {
  if (/^https?:\/\//i.test(path)) return path;
  if (process.env.PUBLIC_ORIGIN) return new URL(path, process.env.PUBLIC_ORIGIN).toString();
  if (process.env.VERCEL_URL) return new URL(path, `https://${process.env.VERCEL_URL}`).toString();

  const proto = req.headers['x-forwarded-proto'] || (req.socket?.encrypted ? 'https' : 'http');
  return new URL(path, `${proto}://${req.headers.host}`).toString();
}

function normalizeImage(input) {
  if (typeof input !== 'string' || !input) return null;
  // Accept both a full data URL and a bare base64 string; normalise to a data
  // URL, which every provider accepts.
  const dataUrl = input.startsWith('data:') ? input : `data:image/jpeg;base64,${input}`;
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  return { dataUrl, bytes: Math.floor((base64.length * 3) / 4) };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return jsonError(res, 405, 'method_not_allowed', 'Use POST.');
  }

  const providerName = (process.env.VTON_PROVIDER || DEFAULT_PROVIDER).toLowerCase();
  const provider = PROVIDERS[providerName];
  if (!provider) {
    return jsonError(
      res,
      500,
      'unknown_provider',
      `VTON_PROVIDER is "${providerName}". Valid values: ${Object.keys(PROVIDERS).join(', ')}.`,
    );
  }

  const { itemId, image, aiGarmentUrl, category, garment_des: garmentDes } = req.body ?? {};

  const garment = GARMENTS.find((g) => g.id === itemId);
  if (!garment) {
    return jsonError(res, 400, 'unknown_item', `No garment with id "${itemId}".`);
  }

  // Validate the client's claims against the catalogue. A mismatch means the two
  // are out of step — a stale bundle after a deploy, or a hand-crafted request —
  // and guessing which side is right is how a URL the server fetches ends up
  // being chosen by the caller.
  const mismatch = [
    ['aiGarmentUrl', aiGarmentUrl, garment.aiGarmentUrl],
    ['category', category, garment.category],
    ['garment_des', garmentDes, garment.garment_des],
  ].find(([, sent, expected]) => sent !== undefined && sent !== expected);

  if (mismatch) {
    return jsonError(
      res,
      400,
      'garment_mismatch',
      `${mismatch[0]} does not match the catalogue entry for ${garment.id}. Reload the page to pick up the current catalogue.`,
    );
  }

  // Guard rail rather than a limitation: without a prepared garment asset there
  // is nothing sensible to send, and a bad input produces output worse than no
  // try-on at all.
  if (!garment.ready) {
    return jsonError(
      res,
      422,
      'garment_not_ready',
      `${garment.id} has no prepared garment asset yet. Run "npm run cutout -- <photo> <dir>" to produce ${garment.aiGarmentUrl}, then set ready = true in src/data/garments.js.`,
    );
  }

  const photo = normalizeImage(image);
  if (!photo) {
    return jsonError(res, 400, 'missing_image', 'Body must include an "image" data URL.');
  }
  if (photo.bytes > MAX_IMAGE_BYTES) {
    return jsonError(
      res,
      413,
      'image_too_large',
      `Captured photo is ${(photo.bytes / 1024 / 1024).toFixed(1)}MB. Downscale to roughly 1024px on the long edge before sending.`,
    );
  }

  const startedAt = Date.now();
  try {
    const { image: output, model } = await provider.generate({
      personDataUrl: photo.dataUrl,
      garmentUrl: absoluteUrl(garment.aiGarmentUrl, req),
      garmentDes: garment.garment_des,
      category: garment.category,
    });

    return res.status(200).json({
      image: output,
      provider: providerName,
      model,
      ms: Date.now() - startedAt,
    });
  } catch (err) {
    // Providers throw with `code` and `status` already mapped to something a
    // person can act on; anything without them is genuinely unexpected.
    return jsonError(
      res,
      err.status ?? 502,
      err.code ?? 'provider_failed',
      err.message || 'The try-on call failed.',
    );
  }
}
