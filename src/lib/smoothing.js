/**
 * One Euro filter. Raw MediaPipe landmarks wobble by a few pixels every frame;
 * feeding that straight into the overlay makes the garment shimmer even when
 * the shopper is standing still. A plain low-pass fixes the shimmer but adds
 * lag on fast movement, so we adapt the cutoff to speed: still => heavy
 * smoothing, moving => light smoothing.
 *
 * Ref: Casiez, Roussel & Vogel (2012).
 */

class LowPass {
  constructor() {
    this.y = null;
  }

  filter(value, alpha) {
    this.y = this.y === null ? value : alpha * value + (1 - alpha) * this.y;
    return this.y;
  }

  reset() {
    this.y = null;
  }
}

class OneEuroScalar {
  constructor({ minCutoff, beta, dCutoff }) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.x = new LowPass();
    this.dx = new LowPass();
    this.prev = null;
    this.prevT = null;
  }

  static alpha(cutoff, dt) {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }

  filter(value, tSeconds) {
    // First sample, or a suspiciously long gap (tab backgrounded, camera
    // stalled): restart rather than integrate a bogus velocity.
    const dt =
      this.prevT === null ? 1 / 30 : Math.min(Math.max(tSeconds - this.prevT, 1e-3), 0.25);
    this.prevT = tSeconds;

    const rawDerivative = this.prev === null ? 0 : (value - this.prev) / dt;
    this.prev = value;

    const edx = this.dx.filter(rawDerivative, OneEuroScalar.alpha(this.dCutoff, dt));
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    return this.x.filter(value, OneEuroScalar.alpha(cutoff, dt));
  }

  reset() {
    this.x.reset();
    this.dx.reset();
    this.prev = null;
    this.prevT = null;
  }
}

/**
 * Smooths a whole landmark array in place-ish (returns a new array).
 * Tuned for normalized (0..1) coordinates at ~30fps.
 */
export class LandmarkSmoother {
  constructor({ minCutoff = 1.7, beta = 0.35, dCutoff = 1.0 } = {}) {
    this.opts = { minCutoff, beta, dCutoff };
    this.filters = new Map();
  }

  #get(key) {
    let f = this.filters.get(key);
    if (!f) {
      f = new OneEuroScalar(this.opts);
      this.filters.set(key, f);
    }
    return f;
  }

  /**
   * @param {Array<{x:number,y:number,z?:number,visibility?:number}>} landmarks
   * @param {number} timestampMs
   */
  apply(landmarks, timestampMs) {
    const t = timestampMs / 1000;
    return landmarks.map((lm, i) => ({
      ...lm,
      x: this.#get(`${i}x`).filter(lm.x, t),
      y: this.#get(`${i}y`).filter(lm.y, t),
    }));
  }

  /** Call when tracking is lost, so the next acquisition snaps instead of sliding in. */
  reset() {
    for (const f of this.filters.values()) f.reset();
  }
}
