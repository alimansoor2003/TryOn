/**
 * Hardcoded catalogue for the demo MVP. No database, per the PRD.
 *
 * Each garment carries two images, produced together by
 * `npm run cutout -- <photo> <dir>`:
 *
 *   thumb        Alpha cutout of the garment alone. Only a carousel thumbnail
 *                now that the live AR overlay is gone.
 *
 *   aiGarmentUrl The IDM-VTON input: the garment cut out, composited on white
 *                and padded to a centred 768x1024. That is the shape VITON-HD
 *                uses, which is what IDM-VTON was trained on — off-ratio or
 *                off-white inputs push the model off its training distribution
 *                and come back warped or discoloured.
 *
 * `garment_des` and `category` are passed straight through to the model. The
 * description is not decoration: IDM-VTON conditions on it, and a vague one
 * ("a shirt") measurably weakens the result versus naming colour, sleeve length
 * and distinguishing details.
 */

export const GARMENTS = [
  {
    id: 'TEE_01',
    name: 'Adicolor 3-Stripes Tee',
    subtitle: 'Black · Regular fit',
    swatch: '#1d1d1f',
    thumb: '/garments/tee-black/overlay.png',
    aiGarmentUrl: '/garments/tee-black/garment.png',
    category: 'upper_body',
    garment_des:
      'black adidas Adicolor 3-Stripes short sleeve t-shirt with white shoulder stripes and white collar trim',
    ready: true,
  },
  {
    id: 'TEE_WHITE',
    name: 'Classic White Tee',
    subtitle: 'White · Regular fit',
    swatch: '#f0f0f2',
    thumb: '/garments/tee-white/overlay.png',
    aiGarmentUrl: '/garments/tee-white/garment.png',
    category: 'upper_body',
    garment_des: 'plain white crew neck short sleeve cotton t-shirt',
    ready: true,
  },
  {
    id: 'SHORTS_01',
    name: 'Adicolor 3-Stripes Shorts',
    subtitle: 'Black · Mid length',
    swatch: '#232326',
    thumb: '/garments/shorts-black/overlay.png',
    aiGarmentUrl: '/garments/shorts-black/garment.png',
    category: 'lower_body',
    garment_des:
      'black adidas Adicolor 3-Stripes woven shorts with white side stripes and elastic waistband',
    ready: true,
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
