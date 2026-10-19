// YIN pitch tracker (de Cheveigné & Kawahara, 2002). Pure TS: no browser APIs, so it runs in
// the app, in Vitest and in Node eval scripts. All buffers are preallocated.

export interface PitchResult {
  /** Hz; 0 when unvoiced. */
  freq: number;
  /** 0..1: 1 minus the CMND dip at the chosen period. */
  confidence: number;
  voiced: boolean;
  rms: number;
}

const MIN_FREQ = 55; // below the cello's open C (65 Hz)
const MAX_FREQ = 1000; // above the Swan's highest note (D5, 587 Hz)
const THRESHOLD = 0.15;
const MIN_CONFIDENCE = 0.5;
const SILENCE_RMS = 10 ** (-50 / 20); // -50 dBFS

export class PitchTracker {
  /** Samples per analysis frame (integration window + longest period). */
  readonly frameSize: number;
  private readonly window: number;
  private readonly minLag: number;
  private readonly maxLag: number;
  private readonly cmnd: Float32Array;
  private readonly buf: Float32Array;

  constructor(readonly sampleRate: number) {
    this.window = Math.round(sampleRate * 0.0213); // ~1024 samples at 48 kHz
    this.minLag = Math.floor(sampleRate / MAX_FREQ);
    this.maxLag = Math.ceil(sampleRate / MIN_FREQ);
    this.frameSize = this.window + this.maxLag + 2;
    this.cmnd = new Float32Array(this.maxLag + 3);
    this.buf = new Float32Array(this.frameSize + 1);
  }

  /** Analyze the most recent `frameSize` samples of `frame`. */
  analyze(frame: Float32Array): PitchResult {
    const off = frame.length - this.frameSize;
    if (off < 0) throw new RangeError(`frame needs ${this.frameSize} samples, got ${frame.length}`);
    const W = this.window;

    let energy = 0;
    for (let j = 0; j < W; j++) energy += frame[off + j]! * frame[off + j]!;
    const rms = Math.sqrt(energy / W);
    if (rms < SILENCE_RMS) return { freq: 0, confidence: 0, voiced: false, rms };

    // Difference function and cumulative mean normalized difference (CMND), computed lag by
    // lag and stopped once the first dip below the threshold has bottomed out (standard YIN).
    const x = this.buf;
    x.set(off === 0 ? frame : frame.subarray(off));
    const d = this.cmnd;
    d[0] = 1;
    let running = 0;
    let tau = -1;
    let best = this.minLag;
    let last = this.maxLag;
    for (let t = 1; t <= last + 1; t++) {
      let sum = 0;
      for (let j = 0; j < W; j++) {
        const diff = x[j]! - x[j + t]!;
        sum += diff * diff;
      }
      running += sum;
      const v = running > 0 ? (sum * t) / running : 1;
      d[t] = v;
      if (t < this.minLag || t > this.maxLag) continue;
      if (v < d[best]!) best = t;
      if (tau < 0 && v < THRESHOLD) {
        tau = t;
        last = Math.min(this.maxLag, t + 1);
      } else if (tau > 0 && t === tau + 1 && v < d[tau]!) {
        tau = t;
        last = Math.min(this.maxLag, t + 1);
      }
    }
    if (tau < 0) tau = best;
    // d[tau + 1] is needed for interpolation; it was computed (the loop runs to last + 1).

    // Parabolic interpolation around the dip.
    const a = d[tau - 1]!;
    const b = d[tau]!;
    const c = d[tau + 1]!;
    const denom = a - 2 * b + c;
    const shift = denom > 0 ? (0.5 * (a - c)) / denom : 0;
    const period = tau + Math.max(-1, Math.min(1, shift));

    const confidence = Math.max(0, Math.min(1, 1 - b));
    const voiced = confidence >= MIN_CONFIDENCE;
    return { freq: voiced ? this.sampleRate / period : 0, confidence, voiced, rms };
  }
}
