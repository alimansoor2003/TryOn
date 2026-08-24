import { Client } from '@gradio/client';

/**
 * Hugging Face Space provider — free, and the default.
 *
 * Calls yisol/IDM-VTON, the Space published by the IDM-VTON authors, through
 * its Gradio API. Same model Replicate charges for, running on Hugging Face's
 * ZeroGPU, reachable without an account. A measured end-to-end run took ~29s.
 *
 * The trade is that this is shared public infrastructure, not an SLA. The Space
 * queues behind everyone else using it, can be restarted or paused by its owner,
 * and ZeroGPU applies a rolling quota per caller. For a shop demo that means the
 * occasional slow or failed run — acceptable when the alternative is a payment
 * method, and the reason the error messages below name the cause precisely.
 *
 * Setting HF_TOKEN (a free token from huggingface.co/settings/tokens) raises the
 * ZeroGPU quota and is worth doing before demoing to anyone.
 */

const SPACE = process.env.HF_SPACE || 'yisol/IDM-VTON';

/**
 * Diffusion steps, and the single biggest lever on whether a request finishes.
 *
 * Measured on this Space: 20 steps ~29s, 30 steps ~54s. Vercel caps a Hobby
 * serverless function at 60s, so the Space's own default of 30 leaves almost no
 * headroom — one busy moment in the shared queue and the function is killed
 * mid-generation, which the shopper sees as a failure rather than a slow result.
 * 20 steps costs a little fine detail and buys back half the budget.
 */
const DENOISE_STEPS = Number(process.env.HF_DENOISE_STEPS || 20);

/** Connection handshake costs a couple of seconds; reuse it while warm. */
let clientPromise = null;

function connect() {
  if (!clientPromise) {
    const options = process.env.HF_TOKEN ? { hf_token: process.env.HF_TOKEN } : {};
    clientPromise = Client.connect(SPACE, options).catch((err) => {
      // Never cache a failed handshake, or one bad moment poisons the instance
      // for as long as it stays warm.
      clientPromise = null;
      throw err;
    });
  }
  return clientPromise;
}

function dataUrlToBlob(dataUrl) {
  const comma = dataUrl.indexOf(',');
  const mime = /data:([^;,]+)/.exec(dataUrl)?.[1] || 'image/jpeg';
  return new Blob([Buffer.from(dataUrl.slice(comma + 1), 'base64')], { type: mime });
}

/**
 * @returns {Promise<{image:string, model:string}>} image is a data URL
 */
export async function generate({ personDataUrl, garmentUrl, garmentDes }) {
  const garmentRes = await fetch(garmentUrl);
  if (!garmentRes.ok) {
    throw Object.assign(
      new Error(`Could not read the garment image (${garmentRes.status}) at ${garmentUrl}.`),
      { code: 'garment_unreadable', status: 502 },
    );
  }
  const garment = new Blob([Buffer.from(await garmentRes.arrayBuffer())], {
    type: garmentRes.headers.get('content-type')?.split(';')[0] || 'image/png',
  });

  let output;
  try {
    const app = await connect();
    // Positional, matching the Space's own signature:
    //   dict (ImageEditor), garm_img, garment_des, is_checked (auto-mask),
    //   is_checked_crop, denoise_steps, seed
    //
    // is_checked=true runs the Space's own human parsing and masking, which is
    // what makes an ordinary phone photo usable — without it the caller has to
    // supply their own mask. Fixed seed so the same photo and garment reproduce;
    // a demo that returns something different each press invites the question of
    // which one was real.
    //
    // is_checked_crop=true matters more than it looks. The Space's own pipeline
    // resizes whatever it's given to VITON-HD's fixed 768x1024 (3:4) canvas.
    // With crop off, that resize is non-uniform: a phone photo — commonly
    // 9:16, nothing like 3:4 — gets squashed to fit, and every body part in it
    // squashes with it, which is exactly a distorted body and stretched hands.
    // With crop on, the Space instead center-crops the photo to a 3:4 box
    // first, runs the *uniform* resize on that, and pastes the try-on result
    // back into the original photo at the crop location — so the parts of the
    // body inside the crop keep their real proportions, and nothing outside it
    // is touched at all.
    const result = await app.predict('/tryon', [
      { background: dataUrlToBlob(personDataUrl), layers: [], composite: null },
      garment,
      garmentDes,
      true,
      true,
      DENOISE_STEPS,
      42,
    ]);
    output = result?.data?.[0];
  } catch (err) {
    const message = String(err?.message ?? err);

    if (/quota|exceeded|GPU task/i.test(message)) {
      throw Object.assign(
        new Error(
          'The free ZeroGPU quota for this Space is used up. Wait a few minutes, or set HF_TOKEN in your environment (free at huggingface.co/settings/tokens) to raise the limit.',
        ),
        { code: 'quota_exceeded', status: 429 },
      );
    }
    if (/sleep|paused|building|starting|not running/i.test(message)) {
      throw Object.assign(
        new Error(
          `The ${SPACE} Space is asleep or restarting. Open huggingface.co/spaces/${SPACE} to wake it, then try again.`,
        ),
        { code: 'space_unavailable', status: 503 },
      );
    }
    throw Object.assign(new Error(message.slice(0, 300)), { code: 'hf_failed', status: 502 });
  }

  const url = output?.url;
  if (!url) {
    throw Object.assign(new Error('The Space returned no image.'), {
      code: 'no_output',
      status: 502,
    });
  }

  // Inline the result rather than passing the URL through. The Space serves it
  // from /tmp, so the link dies with the next restart — and a same-origin data
  // URL also means the Download button needs no cross-origin fetch.
  const imageRes = await fetch(url);
  if (!imageRes.ok) {
    throw Object.assign(new Error(`Could not retrieve the generated image (${imageRes.status}).`), {
      code: 'result_unreadable',
      status: 502,
    });
  }
  const buffer = Buffer.from(await imageRes.arrayBuffer());
  const mime = imageRes.headers.get('content-type')?.split(';')[0] || 'image/png';

  return { image: `data:${mime};base64,${buffer.toString('base64')}`, model: SPACE };
}
