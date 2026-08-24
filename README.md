# In-Store QR WebAR Virtual Try-On

Scan a QR code on a garment tag, open a web page, see the garment on yourself. No app install.

**Status: Photo-AI flow complete.** The real-time WebAR overlay was removed in
favour of a capture-and-generate flow — the live 2D overlay was only ever an
alignment guide, and a static silhouette does that job without the cost. — project setup, live camera, MediaPipe pose tracking, and a 2D garment overlay with automatic scale, tilt and translate. The Phase 4 backend (`/api/tryon` → Replicate IDM-VTON) is implemented and deployable, but its UI is not wired up yet, so the capture button is intentionally disabled. See [Status against the PRD](#status-against-the-prd).

---

## Quick start

```bash
npm install
npm run dev
```

`npm run dev` also serves `/api/*` by running the Vercel functions inside Vite,
so the AI try-on works locally with no keys configured.

Open the printed Network URL on a phone. **The camera will not work over plain `http://`** — see [Testing on a phone](#testing-on-a-phone).

```bash
npm test
```

---

## How it works

```
QR code  ->  /?item_id=TEE_01
                  |
                  v
          getUserMedia  ->  viewfinder + static SVG guide
                  |
         [ shutter ] or [ upload from gallery ]     <- manual only
                  |
                  v
          "Use this photo?"  ->  confirm
                  |
                  v
          POST /api/tryon  ->  Replicate IDM-VTON
                  |
                  v
          Result: save / try another garment / retake
```

The viewfinder is a `<video>` and one inline SVG. No per-frame inference, no
canvas loop, no WASM to download before the camera is usable — removing the
live pose tracking took the bundle from **110KB to 68KB gzipped**.

### Capture is manual, always

There is no timer, no countdown, no burst, and no capture triggered by pose,
focus, or any other signal anywhere in this codebase. A photo is produced by
exactly two actions: pressing the shutter, or picking a file. `useTryOn` takes a
data URL rather than a video element, so the network layer is structurally
incapable of taking a picture.

The gallery input is a plain `<input type="file" accept="image/*">` with **no**
`capture` attribute — adding `capture="user"` would force the OS camera and
defeat the point of offering an existing photo.

Nothing is sent anywhere until the shopper sees the photo and confirms it. That
step also stops a blurred frame becoming a bad result after a 30-second wait,
which the shopper would blame on the app rather than the photo.

### The garment fields

The client sends `aiGarmentUrl`, `category` and `garment_des`, but the server
treats them as a **claim to be checked**, not as instructions. `aiGarmentUrl` is
a URL this server will fetch: taking it on trust would let anyone POST an
internal address and have the server retrieve it. The garment is resolved from
`itemId` server-side and a mismatch is rejected.

`garment_des` is not decoration — IDM-VTON conditions on it, and a vague
description measurably weakens the result against one naming colour, sleeve
length and details.

## Running this for nothing

Every part of the stack is free, including the AI call. No payment method
anywhere.

| Piece | Service | Cost |
|---|---|---|
| Hosting + serverless API | Vercel Hobby | Free |
| AI try-on | `yisol/IDM-VTON` on HF Spaces | **Free, no account** |
| Assets, QR codes | local scripts | Free |

The default provider calls the Space the IDM-VTON authors publish, running on
Hugging Face's ZeroGPU — the same model Replicate charges for. It works
anonymously. Verified end to end at **27.5s** per generation.

```bash
npm run check:vton   # real request through /api/tryon, prints provider and timing
```

Optionally set `HF_TOKEN` (free, no card, from
[huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)) to
raise the ZeroGPU quota. Worth doing before demoing to anyone.

### What "free" costs you

This is shared public infrastructure, not an SLA. The Space queues behind
everyone else using it, its owner can pause or restart it, and ZeroGPU applies a
rolling quota per caller. Expect the occasional slow or failed run. Each of those
cases has its own error message — `quota_exceeded`, `space_unavailable` — rather
than a generic failure.

**Diffusion steps are the lever that matters.** Measured on this Space: 20 steps
~29s, 30 steps ~54s. Vercel caps a Hobby function at 60s, so the Space's own
default of 30 leaves almost no headroom — one busy moment in the queue and the
function is killed mid-generation, which reads as a failure rather than a slow
result. The provider uses 20; raise it with `HF_DENOISE_STEPS` if you move to a
plan with a longer limit.

### The other two providers

```bash
VTON_PROVIDER=huggingface   # default, free
VTON_PROVIDER=replicate     # paid, ~cents/run, most reliable
VTON_PROVIDER=gemini        # paid — see below
```

**Replicate** runs the same IDM-VTON model on dedicated infrastructure: no queue,
no quota, roughly a few cents a prediction. It is the right choice for a demo
that has to work on a schedule. Accounts *without* a payment method are throttled
to about six predictions a minute with a burst of one, so a shopper pressing the
button twice gets a 429.

**Gemini is no longer free.** Google moved image generation off the free tier —
free-tier keys now report `limit: 0` for every image model
(`gemini-3.1-flash-image`, `gemini-2.5-flash-image`, `gemini-3-pro-image`),
verified against a live key. It needs billing enabled in AI Studio. It is also a
general image editor following a try-on instruction rather than a purpose-built
try-on model, so garment fidelity is lower than IDM-VTON.

All three sit behind one interface in `api/providers/`. Switching is one
environment variable; `/api/tryon` and the entire front end are unchanged.

### Model versions (Replicate only)

`cuuupid/idm-vton` is a community model, and an unversioned slug posts to
`/v1/models/{owner}/{name}/predictions`, which only serves Replicate's *official*
models — community ones answer **404** there. The provider resolves the latest
version at cold start and runs through `/v1/predictions`. Pin
`IDM_VTON_MODEL=owner/name:hash` for a demo you intend to repeat.

## Adding real garments

Each garment needs **two different images**, because the two try-on modes read
completely different things from them — the AR overlay wants the garment cut out
of its background, while IDM-VTON wants the ordinary photograph. Both come from
one source photo:

```bash
npm run cutout -- incoming/YOUR_PHOTO.jpg tee-black
```

That writes three files into `public/garments/tee-black/`:

| File | Used by | Shape |
|---|---|---|
| `overlay.png` | AR overlay | Alpha cutout, cropped to the garment |
| `garment.png` | IDM-VTON | Cutout on white, padded to a centred 768×1024 (3:4) |
| `product.jpg` | reference | The untouched source photo |

It also prints the width profile used for calibration.

**Why `garment.png` is shaped that way.** IDM-VTON is trained on VITON-HD, whose
garment images are 768×1024 flat-lays on white. Handing it a square photo on a
grey studio sweep pushes the input off that distribution, which shows up as
warped or discoloured output — and nothing at runtime flags it, because the
request succeeds and simply returns a worse picture. `npm test` asserts the
ratio and white corners so a bad asset fails at build time instead.

### Background removal

**If the source already carries an alpha channel it is honoured as-is**, with no
colour removal. Catalogue images often arrive pre-cut, and dropping their alpha
turns a white tee on transparent into a white tee on black — the fill then eats
whichever of the two it decides is the backdrop. Erosion is skipped for these
too: there is no blended-backdrop halo to shave, so eroding would only eat real
garment.

Otherwise, a **border flood fill**, not a brightness threshold: these garments carry white
stripes and collar trim as bright as the backdrop, so a global threshold punches
holes straight through them. Filling inward from the frame edge only removes
background actually connected to the edge.

The tolerance is **derived from the backdrop's own measured variance**, not
hardcoded, and that is load-bearing. On these photos the white collar is
rgb(238,235,238) against a backdrop of rgb(234,238,239) — a distance of 5.1. Any
tolerance above that eats the collar, and because the white stripes run from the
collar out to the sleeve cuff where they meet the backdrop, the fill enters at
the cuff and travels up, punching the whole ring out. A generous tolerance
destroys it *silently*: the collar is far too small a fraction of the frame to
register as a change in total foreground.

Two more passes handle the cases a fill can't:

- **despeckle** drops blobs below `--despeckle` of the frame — sensor noise,
  dust on the sweep, small patches of floor texture. It is deliberately *not*
  "keep the largest blob": a garment routinely segments into several legitimate
  pieces (on this tee, the back of the collar and one sleeve edge, together
  ~1.6% of foreground), and keeping only the largest silently deletes them.
- **`--dehanger=N`** opens the mask to sever anything thinner than ~2N px —
  hanger hooks, straps, clip marks — which a component filter cannot touch
  because they are attached to the garment.

For a genuinely cluttered photo — garment on a hanger against a room, heavy
floor texture — no heuristic will do. Use a segmentation model first (`rembg`
is the most reliable route on Windows) and feed the result in with
`--no-cutout`.

Then:

1. Add the garment to `src/data/garments.js`, declaring `region` (`upper` / `lower`).
2. Calibrate `span` — see above — and trim with the in-app **Fit** panel.
3. Set `product.ready: true` once the product photo is in place.

`/api/tryon` refuses to run until `product.ready` is `true`, and `npm test` fails
if you set that flag without the assets being present and correctly shaped.

---

## Testing on a phone

`getUserMedia` requires a secure context. A plain `http://192.168.x.x` address has no `navigator.mediaDevices` at all, and the app says so rather than showing a generic camera error.

Deploy to get a real HTTPS URL:

```bash
npx vercel
```

Then set `REPLICATE_API_TOKEN` under Project → Settings → Environment Variables, and redeploy.

### QR codes

```bash
npm run qr -- https://your-app.vercel.app
```

Writes `qr-codes/TEE_01.png` and friends, and prints scannable codes in the terminal. Error correction is set to `H` because these get printed small onto tags that crease, and a scan that fails in front of a customer ends the demo.

---

## Before an in-store demo

The pose model's weights are fetched from Google's CDN on first load. Retail wifi — captive portals, content filters — is the single most likely way this dies in front of a customer. Serve the weights yourself:

```bash
npm run vendor:model
```

Then add `VITE_MODEL_BASE=/mediapipe` to `.env.local` and redeploy. Costs about 4MB.

The WASM runtime is already served from your own origin: `vite.config.js` copies it out of `node_modules` on every build, which also means it can never drift out of version-sync with the installed package.

---

## Environment

Copy `.env.example` to `.env.local`. **Nothing in it is required** — the default
provider works with no key at all.

No key here has a `VITE_` prefix, deliberately. Vite inlines `VITE_*` into the
client bundle, which would hand your key to every shopper who scans a QR code.
They are read only inside `api/`, on the server.

---

## Status against the PRD

| Requirement | State |
|---|---|
| F1 — `item_id` URL routing, per-garment assets | Done. Unknown ids fall back with a visible notice. |
| F2 — WebRTC camera, 33-point pose, auto scale/tilt/translate | Done, upper and lower body. |
| F3 — Capture, generate, result | Done. **Never run against a live provider** — no API key in this environment. |
| F4 — Viewfinder, top bar, carousel, result modal | Done, with before/after compare. |
| NFR — iOS 15+, Android 10+ | Coded for, **not yet verified on real devices**. |
| NFR — 24–30 FPS on mid-range | Pipeline runs at camera framerate; inference measures ~21ms (~48fps of headroom) on an Intel iGPU. **Not yet measured on a mid-range phone.** |
| NFR — no database, hardcoded catalogue | Done. Ships the two real garments that have photography, not three. |

### Known limitations

- **Turning sideways shrinks the garment.** Scale is driven by apparent shoulder width, so rotating away from the camera reads as "smaller". Fixing it properly needs a depth or orientation estimate from the z-landmarks.
- **A 2D overlay does not occlude.** Raise an arm across your chest and the jacket draws over it. Real occlusion needs segmentation masks, roughly another 8ms per frame.
- **No cloth simulation.** The overlay is a rigid stamp: it scales, rotates and translates, but does not fold or drape. That realism is exactly what the Phase 4 diffusion pass is for.
- **Calibration assumes an average adult frame.** `span` is tuned against 39cm shoulders and 19cm hips. A notably larger or smaller shopper gets a proportionally off garment, because the solver scales from joint separation alone.

---

## Layout

```
api/tryon.js              Replicate IDM-VTON call (server-only, holds the token)
src/data/garments.js      The catalogue: both asset types + fit calibration
src/lib/fit.js            Landmarks -> garment transform
src/lib/smoothing.js      One Euro filter, kills overlay shimmer
src/lib/viewport.js       object-fit: cover projection + DPR canvas setup
src/hooks/                Camera, pose model, image preloading, try-on request
src/lib/capture.js        Frame capture: mirror, downscale, encode
src/components/           Viewfinder, top bar, carousel, fit tuner, status states
scripts/                  Tests, QR generation, garment cutouts, model vendoring
```

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Dev server, exposed on the LAN |
| `npm test` | Fit-math and catalogue tests |
| `npm run qr -- <url>` | Generate the in-store QR codes |
| `npm run cutout -- <photo> <dir>` | Turn a product photo into AR + VTON assets |
| `npm run vendor:model` | Download pose weights for offline serving |
