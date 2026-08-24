import Replicate from 'replicate';

/**
 * Replicate / IDM-VTON provider — the paid, higher-fidelity path.
 *
 * IDM-VTON is purpose-built for try-on: trained on garment/person pairs, so it
 * warps the actual garment onto the body rather than following an instruction
 * about it. Better results than a general image editor, at roughly a few cents
 * a prediction, and accounts without a payment method are throttled to about six
 * a minute — enough to stall a live demo.
 */

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
 * answers 404 there, and the failure reads as though the model does not exist.
 * Community models run through /v1/predictions with an explicit version.
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

/**
 * @returns {Promise<{image:string, model:string}>} image is an https URL
 */
export async function generate({ personDataUrl, garmentUrl, garmentDes, category }) {
  if (!process.env.REPLICATE_API_TOKEN) {
    throw Object.assign(
      new Error(
        'REPLICATE_API_TOKEN is not set. Add it to .env.local locally, and to the Vercel project environment variables in production.',
      ),
      { code: 'missing_token', status: 500 },
    );
  }

  const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
  const slug = process.env.IDM_VTON_MODEL || 'cuuupid/idm-vton';

  try {
    const modelRef = await resolveModelRef(replicate, slug);

    // garm_img is pre-normalised at asset build time: cut out, composited on
    // white and padded to a centred 3:4, matching VITON-HD's 768x1024 garment
    // images. Doing it offline keeps it off the request path and makes the exact
    // input reviewable as a file rather than a black box.
    //
    // These field names follow the IDM-VTON schema. Switching to a different
    // try-on model means changing this object and nothing else — the names are
    // not standardised across models.
    const output = await replicate.run(modelRef, {
      input: {
        human_img: personDataUrl,
        garm_img: garmentUrl,
        garment_des: garmentDes,
        category,
        crop: true,
        seed: 42,
        steps: 30,
      },
    });

    // Current client versions return a FileOutput (or an array of them); older
    // ones return a plain URL string.
    const first = Array.isArray(output) ? output[0] : output;
    const url = typeof first === 'string' ? first : first?.url?.();
    if (!url) {
      throw Object.assign(new Error('The model returned no image.'), {
        code: 'no_output',
        status: 502,
      });
    }

    return { image: String(url), model: modelRef };
  } catch (err) {
    if (err.code) throw err;

    // Replicate's own message is long and links to dashboards. The
    // account-level failures are the ones a demo actually hits, and they all
    // have the same fix, so name them plainly rather than pasting an API dump.
    const status = err?.response?.status ?? Number(err?.message?.match(/status (\d{3})/)?.[1]) ?? 0;

    if (status === 402) {
      throw Object.assign(
        new Error(
          'The Replicate account has no credit. Add a payment method at replicate.com/account/billing, or switch to the free provider by setting VTON_PROVIDER=gemini.',
        ),
        { code: 'no_credit', status: 402 },
      );
    }
    if (status === 429) {
      const retryAfter = err?.message?.match(/resets in ~(\d+)s/)?.[1];
      throw Object.assign(
        new Error(
          `Replicate is rate-limiting this account${retryAfter ? ` for another ${retryAfter}s` : ''}. Accounts without a payment method are capped at about six predictions a minute — adding one lifts the limit, or set VTON_PROVIDER=gemini to use the free provider.`,
        ),
        { code: 'rate_limited', status: 429 },
      );
    }
    if (status === 401) {
      throw Object.assign(new Error('REPLICATE_API_TOKEN was rejected. Check the value.'), {
        code: 'bad_token',
        status: 401,
      });
    }

    throw Object.assign(new Error(err?.message || 'The try-on model call failed.'), {
      code: 'replicate_failed',
      status: 502,
    });
  }
}
