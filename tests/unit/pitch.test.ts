import { describe, expect, it } from 'vitest';
import { PitchTracker } from '../../src/dsp/pitch';
import { freqToNote, PitchSmoother } from '../../src/dsp/smooth';

const cents = (f: number, ref: number) => 1200 * Math.log2(f / ref);

/** Render `seconds` of a signal whose instantaneous frequency is `freqAt(t)`, with harmonic amplitudes `amps`. */
function render(sr: number, seconds: number, freqAt: (t: number) => number, amps = [1], gain = 0.5): Float32Array {
  const out = new Float32Array(Math.round(sr * seconds));
  let phase = 0;
  for (let i = 0; i < out.length; i++) {
    phase += (2 * Math.PI * freqAt(i / sr)) / sr;
    let v = 0;
    amps.forEach((a, h) => (v += a * Math.sin((h + 1) * phase)));
    out[i] = gain * v;
  }
  const peak = out.reduce((m, x) => Math.max(m, Math.abs(x)), 0);
  if (peak > 0) for (let i = 0; i < out.length; i++) out[i] = (out[i]! / peak) * gain;
  return out;
}

/** Analyze successive frames with a hop, like the app. Returns per-frame results with their time. */
function track(sr: number, signal: Float32Array, hop = 1024) {
  const tracker = new PitchTracker(sr);
  const results = [];
  for (let end = tracker.frameSize; end <= signal.length; end += hop) {
    results.push({ t: end / sr, ...tracker.analyze(signal.subarray(end - tracker.frameSize, end)) });
  }
  return results;
}

const SAWTOOTH = Array.from({ length: 20 }, (_, h) => 1 / (h + 1));
// Cello-like: weak fundamental, strong 2nd/3rd harmonics.
const CELLO_LIKE = [0.25, 1, 0.8, 0.55, 0.4, 0.3, 0.22, 0.15, 0.1, 0.07];

describe.each([44100, 48000])('PitchTracker at %i Hz', (sr) => {
  it('is within 10 cents on sines from 130 to 600 Hz (quarter-tone steps)', () => {
    for (let c = 0; 130 * 2 ** (c / 1200) <= 600; c += 50) {
      const f = 130 * 2 ** (c / 1200);
      const results = track(sr, render(sr, 0.3, () => f));
      for (const r of results) {
        expect(r.voiced).toBe(true);
        expect(Math.abs(cents(r.freq, f))).toBeLessThan(10);
      }
    }
  });

  it('tracks the open strings C2, G2, D3, A3 within 10 cents', () => {
    for (const midi of [36, 43, 50, 57]) {
      const f = 440 * 2 ** ((midi - 69) / 12);
      for (const r of track(sr, render(sr, 0.5, () => f, CELLO_LIKE))) {
        expect(r.voiced).toBe(true);
        expect(Math.abs(cents(r.freq, f))).toBeLessThan(10);
      }
    }
  });

  it('follows 5.5 Hz vibrato of +/-30 cents without changing the smoothed note', () => {
    for (const base of [220, 293.66]) {
      const freqAt = (t: number) => base * 2 ** ((30 * Math.sin(2 * Math.PI * 5.5 * t)) / 1200);
      const results = track(sr, render(sr, 2, freqAt, CELLO_LIKE));
      const smoother = new PitchSmoother();
      const window = new PitchTracker(sr).frameSize / sr;
      for (const r of results) {
        expect(r.voiced).toBe(true);
        // Compare with the pitch at the centre of the analysis window.
        expect(Math.abs(cents(r.freq, freqAt(r.t - window / 2)))).toBeLessThan(40);
        const s = smoother.push(r.freq, r.voiced);
        expect(freqToNote(s).name).toBe(freqToNote(base).name);
      }
    }
  });

  it('makes octave errors on under 2% of frames for sawtooth and cello-like tones (65-600 Hz)', () => {
    let frames = 0;
    let octaveErrors = 0;
    for (const amps of [SAWTOOTH, CELLO_LIKE]) {
      for (let midi = 36; midi <= 74; midi++) {
        const f = 440 * 2 ** ((midi - 69) / 12);
        for (const r of track(sr, render(sr, 0.4, () => f, amps))) {
          frames++;
          if (!r.voiced || Math.abs(cents(r.freq, f)) > 600) octaveErrors++;
        }
      }
    }
    expect(octaveErrors / frames).toBeLessThan(0.02);
  }, 30_000);

  it('reports silence and quiet noise as unvoiced', () => {
    for (const r of track(sr, new Float32Array(sr))) expect(r.voiced).toBe(false);
    let seed = 1;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
    const noise = new Float32Array(sr).map(() => rand() * 10 ** (-60 / 20) * Math.sqrt(3));
    for (const r of track(sr, noise)) expect(r.voiced).toBe(false);
  });
});

describe('PitchTracker speed', () => {
  it('runs at least 10x faster than real time', () => {
    const sr = 48000;
    const signal = render(sr, 20, () => 196, CELLO_LIKE);
    const t0 = performance.now();
    track(sr, signal);
    const elapsed = (performance.now() - t0) / 1000;
    expect(elapsed).toBeLessThan(20 / 10);
  }, 30_000);
});

describe('freqToNote and PitchSmoother', () => {
  it('names notes and cents relative to A4 = 440 Hz', () => {
    expect(freqToNote(440)).toEqual({ midi: 69, name: 'A4', cents: 0 });
    const r = freqToNote(445);
    expect(r.name).toBe('A4');
    expect(r.cents).toBeCloseTo(19.56, 1);
    expect(freqToNote(65.41).name).toBe('C2');
  });

  it('rejects a single-frame octave spike and resets after silence', () => {
    const s = new PitchSmoother();
    for (const f of [220, 221, 440, 219, 220]) s.push(f, true);
    expect(freqToNote(s.push(220, true)).name).toBe('A3');
    s.push(0, false);
    s.push(0, false);
    expect(s.push(0, false)).toBe(0);
    expect(freqToNote(s.push(330, true)).name).toBe('E4');
  });
});
