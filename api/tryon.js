import Replicate from 'replicate';
import { GARMENTS } from '../src/data/garments.js';

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
 * 200: { image: string, model: string, ms: number }
 *
 * The client sends the garment fields explicitly, but they are treated as a
 * claim to be checked rather than as instructions. `aiGarmentUrl` in particular
 * is a URL this server will fetch: taking it on trust would let anyone POST an
 * internal address and have the server retrieve it for them. So the garment is
 * resolved from `itemId` server-side, and a mismatch is rejected rather than
 * quietly preferring one source over the other.
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

/**
 * Resolved "owner/name:version", cached for the life of the warm instance.
 * One extra API call per cold start, none afterwards.
 */
let cachedModelRef = null;

/**
 * Turns a bare "owner/name" into a versioned reference.
 *
 * Necessary because the two are not interchangeable. Handed an unversioned
 * slug, the client posts to /v1/models/{owner}/{name}/predictions, which only
 * serves Replicate's *official* models — a community model like cuuupid/idm-vton
 * answers 404 there and the failure looks like the model does not exist.
 * Community models run through /v1/predictions with an explicit version, which
 * is what the client does once a version is present.
 *
 * Resolving it here rather than making someone paste a hash keeps the demo
 * working; pin IDM_VTON_MODEL to "owner/name:hash" for a demo you intend to
 * repeat, so a model update cannot change the output under you.
 */
async function resolveModelRef(replicate, slug) {
  if (slug.includes(':')) return slug;
  if (cachedModelRef) return cachedModelRef;

  const [owner, name] = slug.split('/');
  if (!owner || !name) throw new Error(`"${slug}" is not a valid owner/name model slug.`);

  const model = await replicate.models.get(owner, name);
  const version = model?.latest_version?.id;
  if (!version) {
    throw new Error(`Replicate returned no version for ${slug}. Pin one via IDM_VTON_MODEL.`);
  }
  cachedModelRef = `${slug}:${version}`;
  return cachedModelRef;
}

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

  const { itemId, image, aiGarmentUrl, category, garment_des: garmentDes } = req.body ?? {};

  const garment = GARMENTS.find((g) => g.id === itemId);
  if (!garment) {
    return jsonError(res, 400, 'unknown_item', `No garment with id "${itemId}".`);
  }

  // Validate the client's claims against the catalogue. Anything that does not
  // match means the two are out of step — a stale bundle after a deploy, or a
  // hand-crafted request — and guessing which side is right is how a URL the
  // server fetches ends up being chosen by the caller.
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
  // try-on at all. Better to say why than to ship the mush.
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
      `Captured frame is ${(photo.bytes / 1024 / 1024).toFixed(1)}MB. Downscale to roughly 1024px on the long edge before sending.`,
    );
  }

  const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
  const model = process.env.IDM_VTON_MODEL || 'cuuupid/idm-vton';
  const startedAt = Date.now();

  try {
    const modelRef = await resolveModelRef(replicate, model);

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
    const output = await replicate.run(modelRef, {
      input: {
        human_img: photo.dataUrl,
        garm_img: absoluteUrl(garment.aiGarmentUrl, req),
        garment_des: garment.garment_des,
        category: garment.category,
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
      model: cachedModelRef ?? model,
      ms: Date.now() - startedAt,
    });
  } catch (err) {
    // Replicate's own message is long and links to dashboards. The account-level
    // failures are the ones a demo actually hits, and they are all fixed in the
    // same place, so name them plainly instead of pasting an API dump in front
    // of someone standing in a shop.
    const status =
      err?.response?.status ?? Number(err?.message?.match(/status (\d{3})/)?.[1]) ?? 0;

    if (status === 402) {
      return jsonError(
        res,
        402,
        'no_credit',
        'The Replicate account has no credit. Add a payment method at replicate.com/account/billing, then try again in a few minutes.',
      );
    }

    if (status === 429) {
      // Replicate throttles hard until a payment method exists: ~6 predictions
      // a minute with a burst of 1, which a demo trips almost immediately.
      const retryAfter = err?.message?.match(/resets in ~(\d+)s/)?.[1];
      return jsonError(
        res,
        429,
        'rate_limited',
        `Replicate is rate-limiting this account${retryAfter ? ` for another ${retryAfter}s` : ''}. Accounts without a payment method are capped at about 6 predictions a minute — adding one lifts the limit.`,
      );
    }

    if (status === 401) {
      return jsonError(res, 401, 'bad_token', 'REPLICATE_API_TOKEN was rejected. Check the value.');
    }

    return jsonError(res, 502, 'replicate_failed', err?.message || 'The try-on model call failed.');
  }
}
