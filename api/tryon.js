import Replicate from 'replicate';
import { GARMENTS } from '../src/data/garments.js';

/**
 * POST /api/tryon
 *
 * Body: { itemId: string, image: string }  // image = data URL or bare base64
 * 200:  { image: string, model: string, ms: number }
 *
 * Runs on Vercel's Node runtime rather than Edge: the Replicate call routinely
 * outruns the Edge limit, and vercel.json gives this function 60s.
 *
 * The token is read from the environment and never leaves this file. The
 * browser only ever sees the resulting image URL.
 */

// Vercel caps a serverless request body at ~4.5MB. A base64 payload is ~1.33x
// the raw bytes, so anything over this will be rejected by the platform before
// our code runs — we check first so the client gets a useful message instead of
// an opaque 413.
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

const jsonError = (res, status, code, message) =>
  res.status(status).json({ error: { code, message } });

/** Turns a relative asset path into an absolute URL Replicate can fetch. */
function absoluteUrl(path, req) {
  if (/^https?:\/\//i.test(path)) return path;
  const origin =
    process.env.PUBLIC_ORIGIN ||
    (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`) ||
    `https://${req.headers.host}`;
  return new URL(path, origin).toString();
}

function normalizeImage(input) {
  if (typeof input !== 'string' || !input) return null;
  // Accept both a full data URL and a bare base64 string; normalize to a data
  // URL, which Replicate accepts directly as a file input.
  const dataUrl = input.startsWith('data:') ? input : `data:image/jpeg;base64,${input}`;
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const bytes = Math.floor((base64.length * 3) / 4);
  return { dataUrl, bytes };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return jsonError(res, 405, 'method_not_allowed', 'Use POST.');
  }

  if (!process.env.REPLICATE_API_TOKEN) {
    return jsonError(
      res,
      500,
      'missing_token',
      'REPLICATE_API_TOKEN is not set. Add it to .env.local locally, and to the Vercel project environment variables in production.',
    );
  }

  const { itemId, image } = req.body ?? {};

  const garment = GARMENTS.find((g) => g.id === itemId);
  if (!garment) {
    return jsonError(res, 400, 'unknown_item', `No garment with id "${itemId}".`);
  }

  // Guard rail rather than a limitation: without a prepared garment asset there
  // is nothing sensible to send, and a bad input produces output worse than no
  // try-on at all. Better to say why than to ship the mush.
  if (!garment.product?.ready) {
    return jsonError(
      res,
      422,
      'garment_not_ready',
      `${garment.id} has no prepared garment asset yet. Run "npm run cutout -- <photo> <dir>" to produce ${garment.product.src}, then set product.ready = true in src/data/garments.js.`,
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
      `Captured frame is ${(photo.bytes / 1024 / 1024).toFixed(1)}MB. Downscale to roughly 1024px on the long edge before sending.`,
    );
  }

  const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
  const model = process.env.IDM_VTON_MODEL || 'cuuupid/idm-vton';
  const startedAt = Date.now();

  try {
    // garm_img is pre-normalised at asset build time rather than here: cut out,
    // composited on white and padded to a centred 3:4, matching VITON-HD's
    // 768x1024 garment images. Doing it offline keeps it off the request path
    // (no cold-start cost, no segmentation model in the function bundle) and
    // makes the exact input reviewable as a file instead of a black box.
    //
    // Input field names follow the IDM-VTON schema on Replicate. If you switch
    // to a different VTON model, this object is the only thing that changes —
    // check the model's own schema page, since these names are not standardized
    // across try-on models.
    const output = await replicate.run(model, {
      input: {
        human_img: photo.dataUrl,
        garm_img: absoluteUrl(garment.product.src, req),
        garment_des: garment.product.description,
        category: garment.product.category,
        crop: true,
        seed: 42,
        steps: 30,
      },
    });

    // The client returns a FileOutput (or an array of them) on current
    // versions, and a plain URL string on older ones.
    const first = Array.isArray(output) ? output[0] : output;
    const url = typeof first === 'string' ? first : first?.url?.();

    if (!url) {
      return jsonError(res, 502, 'no_output', 'The model returned no image.');
    }

    return res.status(200).json({
      image: String(url),
      model,
      ms: Date.now() - startedAt,
    });
  } catch (err) {
    // Replicate surfaces useful detail here (cold boot timeouts, billing,
    // schema mismatches). Pass it through — this endpoint is not public-facing
    // enough to warrant hiding it, and it saves a deploy cycle when debugging.
    const status = err?.response?.status ?? 502;
    return jsonError(
      res,
      status === 401 ? 401 : 502,
      'replicate_failed',
      err?.message || 'The try-on model call failed.',
    );
  }
}
