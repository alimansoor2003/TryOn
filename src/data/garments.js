/**
 * Hardcoded catalogue for the demo MVP. No database, per the PRD.
 *
 * Each garment carries TWO different assets, because the two try-on modes want
 * fundamentally different source images:
 *
 *   fit.*      -> AR overlay. Alpha cutout of the garment alone, produced by
 *                 `node scripts/cutout.mjs <photo> <dir>`.
 *
 *   product.*  -> IDM-VTON input. The garment cut out, composited on white and
 *                 padded to a centred 3:4, which is the shape VITON-HD (what
 *                 IDM-VTON was trained on) uses. Off-ratio or off-white inputs
 *                 push the model off its training distribution and show up as
 *                 warped or discoloured output.
 *
 * Both are produced by `npm run cutout -- <photo> <dir>`. The untouched source
 * photo is kept alongside them as product.jpg for reference.
 *
 * The numbers in `fit` are properties of the ARTWORK, not of the code. They are
 * derived from the width profile that scripts/cutout.mjs prints, then trimmed
 * against a real body using the in-app Fit panel.
 */

export const GARMENTS = [
  {
    id: 'TEE_01',
    name: 'Adicolor 3-Stripes Tee',
    subtitle: 'Black · Regular fit',
    swatch: '#1d1d1f',
    fit: {
      src: '/garments/tee-black/overlay.png',
      // Hangs from the shoulders.
      region: 'upper',
      anchor: { x: 0.5, y: 0.07 },
      // Calibrated visually against a 39cm-shoulder reference body, not
      // computed from the photo.
      //
      // Deriving it arithmetically fails here: this is a ghost-mannequin shot,
      // not a true laydown. The garment is filled out and shot with
      // perspective, which stretches it to a length:chest ratio of 1.97 where a
      // real tee is about 1.38. Any px/cm scale taken off it is therefore
      // wrong, and the value it produces (0.44) renders the tee roughly 50%
      // oversized. At 0.68 the hem lands on the hip and the sleeves finish
      // just outboard of the shoulder joints, which is what a tee does.
      span: 0.68,
      widthFactor: 1.0,
      offsetY: 0.0,
    },
    product: {
      src: '/garments/tee-black/garment.png',
      category: 'upper_body',
      description: 'black adidas Adicolor 3-Stripes short sleeve t-shirt with white shoulder stripes and white collar trim',
      ready: true,
    },
  },
  {
    id: 'SHORTS_01',
    name: 'Adicolor 3-Stripes Shorts',
    subtitle: 'Black · Mid length',
    swatch: '#232326',
    fit: {
      src: '/garments/shorts-black/overlay.png',
      // Hangs from the hips. Without this the shorts would render across the
      // chest, anchored to the shoulder line like every other garment.
      region: 'lower',
      anchor: { x: 0.5, y: 0.12 },
      // This one IS a true flat-lay, so the arithmetic holds and the visual
      // check agreed with it. The waistband measures 75.9% of image width and
      // runs ~38cm flat on a size M, giving 28.4 px/cm and an artwork spanning
      // ~50cm. Hip joint centres sit ~19cm apart: 0.38 of image width.
      span: 0.38,
      widthFactor: 1.0,
      offsetY: 0.0,
    },
    product: {
      src: '/garments/shorts-black/garment.png',
      category: 'lower_body',
      description: 'black adidas Adicolor 3-Stripes woven shorts with white side stripes and elastic waistband',
      ready: true,
    },
  },
];

export const DEFAULT_GARMENT_ID = GARMENTS[0].id;

/**
 * Resolves the `item_id` query parameter from the QR code to a garment.
 * Unknown or missing ids fall back to the first item so a mis-printed QR code
 * still opens a working demo instead of a blank screen.
 *
 * @param {string | null | undefined} itemId
 */
export function resolveGarment(itemId) {
  if (!itemId) return { garment: GARMENTS[0], matched: false };
  const needle = String(itemId).trim().toUpperCase();
  const found = GARMENTS.find((g) => g.id.toUpperCase() === needle);
  return { garment: found ?? GARMENTS[0], matched: Boolean(found) };
}
