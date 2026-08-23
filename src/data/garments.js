/**
 * Hardcoded catalogue for the demo MVP. No database, per the PRD.
 *
 * Each garment carries TWO different assets, because the two try-on modes want
 * fundamentally different source images:
 *
 *   fit.*      -> AR overlay. A front-facing, alpha-cut PNG of the garment
 *                 alone, laid flat and symmetrical. Shadows baked into the
 *                 cutout read as dirt on a live video feed, so keep it clean.
 *
 *   product.*  -> IDM-VTON input (Phase 4). A normal product photograph:
 *                 flat-lay or on a plain mannequin, full garment in frame,
 *                 white/neutral background. The diffusion model reads texture
 *                 and drape from this, so a silhouette or cutout produces mush.
 *
 * Swapping in real photography = replace the file, update `src`, then re-tune
 * the four numbers in `fit` using the calibration panel (tap the FPS badge).
 */

/** @typedef {{x:number,y:number}} Point */

export const GARMENTS = [
  {
    id: 'SUIT_01',
    name: 'Midnight Navy',
    subtitle: 'Two-piece · Slim fit',
    swatch: '#1e2a44',
    fit: {
      src: '/garments/suit-01/overlay.svg',
      // Where the wearer's shoulder line sits inside the image, normalized.
      anchor: { x: 0.5, y: 0.19 },
      // Fraction of the image width between the two shoulder seams.
      shoulderSpan: 0.62,
      // Garment shoulder width as a multiple of the wearer's measured shoulder
      // width. Tailoring plus the jacket's own structure means this is > 1.
      widthFactor: 1.3,
      // Nudge along the torso axis, in shoulder-width units. +down / -up.
      offsetY: 0.02,
    },
    product: {
      src: '/garments/suit-01/product.jpg',
      category: 'upper_body',
      description: 'navy single-breasted suit jacket with notch lapels',
      // Flip to true once a real product photograph is in place. The capture
      // button stays disabled while this is false rather than sending a
      // silhouette to the model and returning nonsense.
      ready: false,
    },
  },
  {
    id: 'SUIT_02',
    name: 'Charcoal Grey',
    subtitle: 'Two-piece · Classic fit',
    swatch: '#3c3f45',
    fit: {
      src: '/garments/suit-02/overlay.svg',
      anchor: { x: 0.5, y: 0.19 },
      shoulderSpan: 0.62,
      widthFactor: 1.34,
      offsetY: 0.02,
    },
    product: {
      src: '/garments/suit-02/product.jpg',
      category: 'upper_body',
      description: 'charcoal grey wool suit jacket, single-breasted',
      ready: false,
    },
  },
  {
    id: 'SUIT_03',
    name: 'Tobacco Brown',
    subtitle: 'Two-piece · Relaxed fit',
    swatch: '#5a4632',
    fit: {
      src: '/garments/suit-03/overlay.svg',
      anchor: { x: 0.5, y: 0.19 },
      shoulderSpan: 0.62,
      widthFactor: 1.36,
      offsetY: 0.025,
    },
    product: {
      src: '/garments/suit-03/product.jpg',
      category: 'upper_body',
      description: 'tobacco brown linen-blend suit jacket',
      ready: false,
    },
  },
];

export const DEFAULT_GARMENT_ID = GARMENTS[0].id;

/**
 * Resolves the `item_id` query parameter from the QR code to a garment.
 * Unknown or missing ids fall back to the first suit so a mis-printed QR code
 * still opens a working demo instead of a blank screen.
 *
 * @param {string | null | undefined} itemId
 * @returns {{ garment: typeof GARMENTS[number], matched: boolean }}
 */
export function resolveGarment(itemId) {
  if (!itemId) return { garment: GARMENTS[0], matched: false };
  const needle = String(itemId).trim().toUpperCase();
  const found = GARMENTS.find((g) => g.id.toUpperCase() === needle);
  return { garment: found ?? GARMENTS[0], matched: Boolean(found) };
}
