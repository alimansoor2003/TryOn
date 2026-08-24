/**
 * Google Gemini image provider — the free default.
 *
 * Chosen because it is the only try-on-capable option with a free tier that
 * needs no card: roughly 500 images a day on the API. Replicate charges per
 * prediction and throttles hard to about six a minute until a payment method
 * exists, which is enough to stall a demo mid-conversation.
 *
 * The trade is quality and control. IDM-VTON is a purpose-built try-on model
 * trained on garment/person pairs; Gemini is a general image editor being asked
 * to do a try-on, so it follows the instruction rather than a learned warping of
 * the specific garment. It is very good, but it is not the same thing, and it
 * will occasionally restyle something it was told to leave alone.
 */

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const DEFAULT_MODEL = 'gemini-3.1-flash-image';

/** Garment images are a fixed catalogue, so fetch each one once per warm instance. */
const garmentCache = new Map();

async function fetchGarmentBase64(url) {
  const cached = garmentCache.get(url);
  if (cached) return cached;

  const res = await fetch(url);
  if (!res.ok) {
    throw Object.assign(new Error(`Could not read the garment image (${res.status}) at ${url}.`), {
      code: 'garment_unreadable',
      status: 502,
    });
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  const entry = {
    data: buffer.toString('base64'),
    mimeType: res.headers.get('content-type')?.split(';')[0] || 'image/png',
  };
  garmentCache.set(url, entry);
  return entry;
}

function splitDataUrl(dataUrl) {
  const match = /^data:([^;,]+)?[^,]*,(.*)$/s.exec(dataUrl);
  if (!match) return { mimeType: 'image/jpeg', data: dataUrl };
  return { mimeType: match[1] || 'image/jpeg', data: match[2] };
}

/**
 * The instruction carries the weight here, since nothing about the model is
 * try-on specific. The negative half — keep the face, pose, background — matters
 * more than the positive half: told only to dress someone, the model happily
 * returns a different, better-lit person wearing the right shirt.
 */
function buildPrompt(garmentDes, category) {
  const placement =
    category === 'lower_body'
      ? 'Replace only the trousers, shorts or skirt the person is wearing.'
      : category === 'dresses'
        ? 'Replace the full outfit with the dress.'
        : 'Replace only the top the person is wearing. Leave their trousers, shorts or skirt untouched.';

  return [
    'This is a virtual clothing try-on.',
    'The first image is a photograph of a person. The second image is a garment on a plain background.',
    placement,
    `The garment is: ${garmentDes}.`,
    'Dress the person in that exact garment, matching its colour, pattern, logos, trim and proportions precisely.',
    'It must sit naturally on their body with realistic folds, drape and shadows, and follow their pose.',
    'Keep the person identical: same face, hair, skin tone, body shape, pose and expression.',
    'Keep the background, framing, lighting and image quality exactly as they are.',
    'Return only the edited photograph.',
  ].join(' ');
}

/**
 * @returns {Promise<{image:string, model:string}>} image is a data URL
 */
export async function generate({ personDataUrl, garmentUrl, garmentDes, category }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw Object.assign(
      new Error(
        'GEMINI_API_KEY is not set. Get a free key at aistudio.google.com/apikey, put it in .env.local, and add it to your Vercel project environment variables.',
      ),
      { code: 'missing_key', status: 500 },
    );
  }

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const person = splitDataUrl(personDataUrl);
  const garment = await fetchGarmentBase64(garmentUrl);

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      model,
      input: [
        { type: 'text', text: buildPrompt(garmentDes, category) },
        { type: 'image', mime_type: person.mimeType, data: person.data },
        { type: 'image', mime_type: garment.mimeType, data: garment.data },
      ],
    }),
  });

  const raw = await res.text();
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw Object.assign(new Error(`Gemini returned a non-JSON response (${res.status}).`), {
      code: 'bad_response',
      status: 502,
    });
  }

  if (!res.ok) {
    const detail = payload?.error?.message || raw.slice(0, 300);
    if (res.status === 429) {
      throw Object.assign(
        new Error(
          'Gemini is rate-limiting this key. The free tier allows a few requests a minute — wait a moment and try again.',
        ),
        { code: 'rate_limited', status: 429 },
      );
    }
    if (res.status === 400 && /API key/i.test(detail)) {
      throw Object.assign(new Error('GEMINI_API_KEY was rejected. Check the value.'), {
        code: 'bad_key',
        status: 401,
      });
    }
    throw Object.assign(new Error(detail), { code: 'gemini_failed', status: 502 });
  }

  const image = findImage(payload);
  if (!image) {
    // A refusal comes back as a successful response carrying only text, so the
    // absence of an image is the signal — surface whatever it said instead of a
    // bare "no output".
    const text = findText(payload);
    throw Object.assign(
      new Error(
        text
          ? `Gemini returned no image. It said: "${text.slice(0, 200)}"`
          : 'Gemini returned no image.',
      ),
      { code: 'no_output', status: 502 },
    );
  }

  return { image: `data:${image.mimeType};base64,${image.data}`, model };
}

/**
 * Walks the response for the first image payload.
 *
 * Deliberately shape-agnostic: this API is young and the exact nesting of
 * steps/content blocks has already moved once. A recursive search for something
 * that looks like inline image data survives that; a hardcoded path does not.
 */
function findImage(node) {
  if (!node || typeof node !== 'object') return null;

  const data = node.data ?? node.inlineData?.data ?? node.inline_data?.data;
  const mimeType =
    node.mime_type ?? node.mimeType ?? node.inlineData?.mimeType ?? node.inline_data?.mime_type;
  if (typeof data === 'string' && data.length > 512 && /^image\//.test(mimeType ?? '')) {
    return { data, mimeType };
  }

  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        const hit = findImage(item);
        if (hit) return hit;
      }
    } else if (value && typeof value === 'object') {
      const hit = findImage(value);
      if (hit) return hit;
    }
  }
  return null;
}

function findText(node) {
  if (!node || typeof node !== 'object') return null;
  if (typeof node.text === 'string' && node.text.trim()) return node.text.trim();
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        const hit = findText(item);
        if (hit) return hit;
      }
    } else if (value && typeof value === 'object') {
      const hit = findText(value);
      if (hit) return hit;
    }
  }
  return null;
}
