import { Client } from '@gradio/client';

/**
 * Calls the IDM-VTON Space straight from the browser, bypassing our own server.
 *
 * This exists because routing the call through a server is what breaks it.
 * Hugging Face restricts free ZeroGPU to non-datacenter callers: the identical
 * token, photo and code succeed from a phone or laptop in ~19s and are refused
 * by Vercel in 2.8s, before any GPU work starts. No token lifts that — it is the
 * caller's IP that decides, and a serverless function has the wrong kind.
 *
 * Calling from the shopper's own device fixes it and is a better shape anyway:
 *
 *   - Each shopper draws on their own quota instead of everyone queueing behind
 *     one shared allowance.
 *   - The 60s serverless function ceiling stops applying, so a slow queue is
 *     just slow rather than a hard failure.
 *   - The photo goes from the phone to the Space without passing through us at
 *     all, which is less of the shopper's body travelling through our servers.
 *
 * No token is sent. Anonymous quota is per-IP, and on a phone that is exactly
 * the right granularity — a token here would have to ship in the client bundle,
 * where it would be readable by anyone who opened devtools.
 */

const SPACE = import.meta.env.VITE_HF_SPACE || 'yisol/IDM-VTON';

/** Matches the server provider. 20 steps ~20s, 30 steps ~50s. */
const DENOISE_STEPS = 20;

/** Connection handshake costs a couple of seconds; reuse it across attempts. */
let clientPromise = null;

function connect() {
  if (!clientPromise) {
    clientPromise = Client.connect(SPACE).catch((err) => {
      // Never cache a failed handshake, or one bad moment breaks the page until
      // it is reloaded.
      clientPromise = null;
      throw err;
    });
  }
  return clientPromise;
}

function dataUrlToBlob(dataUrl) {
  const comma = dataUrl.indexOf(',');
  const mime = /data:([^;,]+)/.exec(dataUrl)?.[1] || 'image/jpeg';
  const binary = atob(dataUrl.slice(comma + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/** Turns a mapped failure into the same shape /api/tryon returns, so the UI
 *  renders both identically. */
function fail(code, message, detail) {
  return Object.assign(new Error(message), { code, detail });
}

/**
 * @param {string} personDataUrl the shopper's photo
 * @param {object} garment catalogue entry
 * @param {AbortSignal} [signal]
 * @returns {Promise<{image:string, provider:string, model:string, ms:number}>}
 */
export async function tryOnDirect(personDataUrl, garment, signal) {
  const startedAt = Date.now();

  const garmentRes = await fetch(garment.aiGarmentUrl, { signal });
  if (!garmentRes.ok) {
    throw fail('garment_unreadable', `Could not load the garment image (${garmentRes.status}).`);
  }
  const garmentBlob = await garmentRes.blob();

  let output;
  const attemptStart = Date.now();
  try {
    const app = await connect();
    // Positional, matching the Space's signature: dict (ImageEditor), garm_img,
    // garment_des, is_checked (auto-mask), is_checked_crop, denoise_steps, seed.
    //
    // is_checked_crop=true is load-bearing. Without it the Space resizes the
    // whole photo onto a fixed 3:4 canvas in one non-uniform step, and a 9:16
    // phone photo gets stretched — visibly distorting the body and hands. With
    // it, the photo is centre-cropped to 3:4 first, resized uniformly, and the
    // result pasted back into the untouched original.
    const result = await app.predict('/tryon', [
      { background: dataUrlToBlob(personDataUrl), layers: [], composite: null },
      garmentBlob,
      garment.garment_des,
      true,
      true,
      DENOISE_STEPS,
      42,
    ]);
    output = result?.data?.[0];
  } catch (err) {
    const message = String(err?.message ?? err);
    const elapsed = Date.now() - attemptStart;

    if (/quota|exceeded|GPU task/i.test(message)) {
      const wait = message.match(/Try again in ([\d:]+)/)?.[1];
      throw fail(
        'quota_exceeded',
        `The free GPU is busy${wait ? `, and frees up in ${wait}` : ''}. Try again in a few minutes.`,
        message,
      );
    }
    if (/sleep|paused|building|starting|not running/i.test(message)) {
      throw fail('space_unavailable', 'The try-on service is restarting. Try again shortly.', message);
    }

    // Gradio reports everything inside the Space as the literal string "An error
    // occurred". Elapsed time is what separates a refusal from a real failure: a
    // genuine model error has to clear human parsing and pose detection first,
    // which costs seconds, while a refusal returns almost immediately.
    if (/^["']?An error occurred/i.test(message.trim())) {
      if (elapsed < 8000) {
        throw fail(
          'quota_exceeded',
          'The free GPU turned the request away before starting. Wait a few minutes and try again.',
          message,
        );
      }
      throw fail(
        'photo_unusable',
        'The model could not read a body in that photo. Use a full-body shot of one person, facing the camera, in good light.',
        message,
      );
    }

    throw fail('hf_failed', message.slice(0, 200), message);
  }

  if (!output?.url) throw fail('no_output', 'The try-on service returned no image.');

  // Inline the result. The Space serves it from /tmp, so the link dies with the
  // next restart, and a blob URL also keeps the download button working without
  // a second cross-origin fetch.
  const imageRes = await fetch(output.url, { signal });
  if (!imageRes.ok) {
    throw fail('result_unreadable', `Could not retrieve the generated image (${imageRes.status}).`);
  }
  const blob = await imageRes.blob();
  const image = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(fail('result_unreadable', 'Could not read the generated image.'));
    reader.readAsDataURL(blob);
  });

  return { image, provider: 'huggingface-direct', model: SPACE, ms: Date.now() - startedAt };
}
