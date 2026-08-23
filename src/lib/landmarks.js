/**
 * MediaPipe's 33-point pose topology. Same indices in the legacy `@mediapipe/pose`
 * solution and the newer Tasks API, so these constants stay valid either way.
 */
export const LM = {
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
};

/** Bones drawn by the debug skeleton view. */
export const SKELETON_EDGES = [
  [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER],
  [LM.LEFT_SHOULDER, LM.LEFT_ELBOW],
  [LM.LEFT_ELBOW, LM.LEFT_WRIST],
  [LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW],
  [LM.RIGHT_ELBOW, LM.RIGHT_WRIST],
  [LM.LEFT_SHOULDER, LM.LEFT_HIP],
  [LM.RIGHT_SHOULDER, LM.RIGHT_HIP],
  [LM.LEFT_HIP, LM.RIGHT_HIP],
  [LM.LEFT_HIP, LM.LEFT_KNEE],
  [LM.LEFT_KNEE, LM.LEFT_ANKLE],
  [LM.RIGHT_HIP, LM.RIGHT_KNEE],
  [LM.RIGHT_KNEE, LM.RIGHT_ANKLE],
];

/** The four points the garment fit actually depends on. */
export const FIT_LANDMARKS = [
  LM.LEFT_SHOULDER,
  LM.RIGHT_SHOULDER,
  LM.LEFT_HIP,
  LM.RIGHT_HIP,
];
