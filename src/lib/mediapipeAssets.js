/**
 * Where the pose runtime loads its WASM and model weights from.
 *
 * The WASM binaries are always served from our own origin — a Vite plugin
 * copies them out of node_modules on every dev start and build, so the runtime
 * can never fall out of step with the installed @mediapipe/tasks-vision.
 *
 * The model weights still come from Google's CDN by default. For an actual
 * in-store demo run `npm run vendor:model` and set VITE_MODEL_BASE=/mediapipe
 * in .env.local — shop wifi with a captive portal or an aggressive content
 * filter is the most likely way this demo dies in front of a customer.
 */
const CDN_MODEL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

export const WASM_BASE = '/mediapipe/wasm';

export const MODEL_URL = import.meta.env.VITE_MODEL_BASE
  ? `${import.meta.env.VITE_MODEL_BASE}/pose_landmarker_lite.task`
  : CDN_MODEL;

// `lite` over `full`/`heavy` deliberately: on a mid-range Android the full
// model lands around 12-15fps, which fails the PRD's 24fps floor. The accuracy
// difference is invisible once a garment is stamped over the body.
