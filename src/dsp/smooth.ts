import { midiToName } from '../score/position';

export interface NoteReading {
  midi: number;
  name: string;
  /** Deviation from the equal-tempered note, in cents (A4 = 440 Hz). */
  cents: number;
}

/** Nearest equal-tempered note to `freq` (A4 = 440 Hz) and the deviation in cents. */
export function freqToNote(freq: number): NoteReading {
  const exact = 69 + 12 * Math.log2(freq / 440);
  const midi = Math.round(exact);
  return { midi, name: midiToName(midi), cents: (exact - midi) * 100 };
}

/**
 * Median of the last few voiced pitches (in cents), so a single stray frame, such as an
 * octave jump, doesn't show. A few unvoiced frames in a row reset it.
 */
export class PitchSmoother {
  private readonly cents: number[] = [];
  private unvoiced = 0;

  constructor(
    private readonly size = 5,
    private readonly resetAfter = 3,
  ) {}

  /** Feed one frame's result; returns the smoothed frequency, or 0 while unvoiced. */
  push(freq: number, voiced: boolean): number {
    if (!voiced) {
      if (++this.unvoiced >= this.resetAfter) this.cents.length = 0;
      return 0;
    }
    this.unvoiced = 0;
    this.cents.push(1200 * Math.log2(freq / 440));
    if (this.cents.length > this.size) this.cents.shift();
    const sorted = [...this.cents].sort((x, y) => x - y);
    return 440 * 2 ** (sorted[sorted.length >> 1]! / 1200);
  }
}
