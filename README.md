# In-Store QR WebAR Virtual Try-On

Scan a QR code on a garment tag, open a web page, see the garment on yourself. No app install.

**Status: Phases 1–3 complete and working** — project setup, live camera, MediaPipe pose tracking, and a 2D garment overlay with automatic scale, tilt and translate. The Phase 4 backend (`/api/tryon` → Replicate IDM-VTON) is implemented and deployable, but its UI is not wired up yet, so the capture button is intentionally disabled. See [Status against the PRD](#status-against-the-prd).

---

## Quick start

```bash
npm install
npm run dev
```

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
          getUserMedia (front camera)
                  |
                  v
          MediaPipe PoseLandmarker  ->  33 landmarks
                  |
                  v
          One Euro smoothing  ->  fit solver  ->  Canvas 2D overlay
```

One `requestAnimationFrame` loop does detect-and-draw together. Splitting them onto separate schedules always renders the garment against the previous frame's pose, and that one-frame offset is what people describe as "the jacket lags behind me".

### The fit solver

`src/lib/fit.js` turns four landmarks into a transform. Garments declare a `region`, which selects the joints they hang from:

| `region` | Reference joints (scale, angle, position) | Extent joints (length correction) |
|---|---|---|
| `upper` | Shoulders — 11, 12 | Hips — 23, 24 |
| `lower` | Hips — 23, 24 | Knees — 25, 26 |

A garment without `region` defaults to `upper`, so shorts that forget to declare
`lower` render across the chest. `npm test` fails on that.

The extent joints are **optional at runtime**. Hips leave the frame in a close
crop and knees leave it in almost any try-on framing; losing them costs the
length correction, not the whole overlay.

The length correction is clamped on purpose. An unclamped ratio means one bad hip detection stretches the jacket to the floor for a frame, and a single frame of that is more noticeable than never correcting at all.

The solver returns `null` — drawing nothing — when joints fall below 0.55 visibility or the person is too small in frame. A garment stamped onto a half-detected body looks broken in a way that "step back into frame" does not.

### Calibrating a garment

The numbers in each garment's `fit` block are properties of *the artwork*, not of the code, so they have to be re-derived whenever you replace an image.

`span` is the one that matters and the one that is easy to get wrong. It is the
fraction of the artwork's width covering the wearer's **joint separation** — not
the garment's outline at that height. On a tee the sleeve caps sit well outboard
of the shoulder joints, so reading `span` off the silhouette makes the garment
render far too small.

Where the photo is a true flat-lay you can compute it: take a known measurement
off the width profile (`npm run cutout` prints one), convert to px/cm, and
express the joint separation — 39cm between adult shoulder joints, 19cm between
hip joints — as a fraction of image width. That is how `SHORTS_01` was derived.

Where the photo is a **ghost-mannequin shot** the arithmetic does not hold: the
garment is filled out and shot with perspective, so its proportions do not match
the real garment. `TEE_01`'s photo has a length:chest ratio of 1.97 against a real
tee's 1.38, and the computed `span` renders it ~50% oversized. Those need
calibrating by eye instead.

Tap **Fit** in the top bar for live sliders, adjust while watching yourself, then hit **Copy fit block** and paste the result into `src/data/garments.js`. About a minute per garment; editing a file and reloading on a phone takes far longer.

Drop **Opacity** below 1 to see how the garment lines up against your actual body, and enable **Show pose landmarks** to confirm tracking is sane.

---

## Adding real garments

Each garment needs **two different images**, because the two try-on modes read
completely different things from them — the AR overlay wants the garment cut out
of its background, while IDM-VTON wants the ordinary photograph. Both come from
one source photo:

```bash
npm run cutout -- incoming/YOUR_PHOTO.jpg tee-black
```

That writes `public/garments/tee-black/overlay.png` (alpha cutout for the AR
overlay) and `product.jpg` (the untouched photo, for IDM-VTON), and prints the
width profile used for calibration.

Background removal is a **border flood fill**, not a brightness threshold. These
garments carry white stripes and white collar trim that are as bright as the
studio backdrop, so a global threshold punches holes straight through them.
Filling inward from the frame edge only removes background actually connected to
the edge, leaving interior white intact.

Then:

1. Add the garment to `src/data/garments.js`, declaring `region` (`upper` / `lower`).
2. Calibrate `span` — see above — and trim with the in-app **Fit** panel.
3. Set `product.ready: true` once the product photo is in place.

A cutout will not work as a `product.src`: IDM-VTON reads texture and drape from
that image. `/api/tryon` refuses to run until `product.ready` is `true`, and
`npm test` fails if you set that flag without adding the file.

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

Copy `.env.example` to `.env.local`. Only `REPLICATE_API_TOKEN` is required, and only for Phase 4.

That variable deliberately has **no** `VITE_` prefix. Vite inlines `VITE_*` variables into the client bundle, which would hand the token to every shopper who scans a QR code. It is read only inside `api/tryon.js`, on the server.

---

## Status against the PRD

| Requirement | State |
|---|---|
| F1 — `item_id` URL routing, per-garment assets | Done. Unknown ids fall back with a visible notice. |
| F2 — WebRTC camera, 33-point pose, auto scale/tilt/translate | Done, upper and lower body. |
| F3 — Capture, IDM-VTON, result | Backend done (`api/tryon.js`); UI not wired. |
| F4 — Viewfinder, top bar, carousel, result modal | Viewfinder, top bar and carousel done. Result modal pending with F3. |
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
src/hooks/                Camera, pose model, image preloading
src/components/           Viewfinder, top bar, carousel, fit tuner, status states
scripts/                  Tests, QR generation, garment cutouts, model vendoring
```

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Dev server, exposed on the LAN |
| `npm test` | Fit-math and catalogue tests |
| `npm run qr -- <url>` | Generate the in-store QR codes |
| `npm run cutout -- <photo> <dir>` | Turn a product photo into overlay + product assets |
| `npm run vendor:model` | Download pose weights for offline serving |
