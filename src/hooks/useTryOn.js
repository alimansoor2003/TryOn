import { useCallback, useEffect, useRef, useState } from 'react';
import { captureFrame } from '../lib/capture.js';

/**
 * Drives one AI try-on: capture the frame, post it, hold the result.
 *
 * `status` is an explicit state machine rather than a pile of booleans, because
 * the UI has to distinguish "uploading" from "the model is running" — those feel
 * completely different to someone standing in a shop, and only one of them has
 * an end the user can predict.
 */

/** @typedef {'idle'|'capturing'|'processing'|'done'|'error'} TryOnStatus */

/**
 * Replicate cold-starts IDM-VTON on an idle model, and that dominates the wait.
 * A warm run lands in single-digit seconds; a cold one can take half a minute.
 * The UI shows elapsed time rather than a countdown, because a countdown implies
 * a deadline we cannot honour and looks broken when it hits zero and continues.
 */
const REQUEST_TIMEOUT_MS = 90_000;

export function useTryOn() {
  const [status, setStatus] = useState(/** @type {TryOnStatus} */ ('idle'));
  const [result, setResult] = useState(null);
  const [captured, setCaptured] = useState(null);
  const [error, setError] = useState(null);
  const [elapsed, setElapsed] = useState(0);

  const abortRef = useRef(null);
  const startedAtRef = useRef(0);

  // Tick the elapsed counter only while a request is genuinely in flight.
  useEffect(() => {
    if (status !== 'processing') return;
    const id = setInterval(() => {
      setElapsed((Date.now() - startedAtRef.current) / 1000);
    }, 100);
    return () => clearInterval(id);
  }, [status]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const run = useCallback(async (video, garment, { mirror }) => {
    setStatus('capturing');
    setError(null);
    setResult(null);
    setElapsed(0);

    let frame;
    try {
      frame = captureFrame(video, { mirror });
      setCaptured(frame.dataUrl);
    } catch (err) {
      setError({ code: 'capture_failed', message: err.message });
      setStatus('error');
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    startedAtRef.current = Date.now();
    setStatus('processing');

    try {
      const res = await fetch('/api/tryon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: garment.id, image: frame.dataUrl }),
        signal: controller.signal,
      });

      // The endpoint reports failures as structured JSON. A non-JSON body means
      // something in front of it broke, and the specific case worth naming is a
      // dev server with no API mounted: the SPA fallback answers the POST with
      // index.html and a 200, so a bare parse error would send someone hunting
      // for a bug in the handler that is not running at all.
      const contentType = res.headers.get('content-type') ?? '';
      if (contentType.includes('text/html')) {
        throw Object.assign(
          new Error(
            'The /api/tryon endpoint is not responding — the request was answered by the front end instead. Restart the dev server, or deploy with `npx vercel`.',
          ),
          { code: 'api_not_mounted' },
        );
      }

      let payload;
      try {
        payload = await res.json();
      } catch {
        throw Object.assign(new Error(`The server returned ${res.status} with an unreadable body.`), {
          code: 'bad_response',
        });
      }

      if (!res.ok) {
        throw Object.assign(new Error(payload?.error?.message ?? `Request failed (${res.status}).`), {
          code: payload?.error?.code ?? 'request_failed',
        });
      }

      setResult({ image: payload.image, ms: payload.ms, model: payload.model });
      setStatus('done');
    } catch (err) {
      if (err.name === 'AbortError') {
        setError({
          code: 'timeout',
          message:
            'The model did not respond within 90 seconds. This is usually a cold start — try once more and it should be much quicker.',
        });
      } else {
        setError({ code: err.code ?? 'network', message: err.message });
      }
      setStatus('error');
    } finally {
      clearTimeout(timeout);
      abortRef.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setStatus('idle');
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setStatus('idle');
    setResult(null);
    setCaptured(null);
    setError(null);
    setElapsed(0);
  }, []);

  return { status, result, captured, error, elapsed, run, cancel, reset };
}
