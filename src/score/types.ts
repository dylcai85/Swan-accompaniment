/** A note in score time. Ticks only: seconds exist only at the audio edge (CLAUDE.md). */
export interface Note {
  tick: number;
  durTicks: number;
  midi: number;
  /** 0..1 */
  velocity: number;
}

export interface Score {
  name: string;
  ppq: number;
  /** [numerator, denominator], e.g. [6, 4]. */
  timeSig: [number, number];
  ticksPerBar: number;
  /** Ticks per beat of the time signature's denominator (a quarter in 6/4). */
  ticksPerBeat: number;
  /** Median of the file's tempo events. The tempo map itself is ignored. */
  nominalBpm: number;
  /** Bar number (1-based) of the last note onset. */
  bars: number;
  /** Monophonic: sorted by tick, overlaps clipped. */
  cello: Note[];
  piano1: Note[];
  piano2: Note[];
  /** Diagnostics from parsing, e.g. how many cello overlaps were clipped. */
  info: {
    tempoEvents: number;
    celloOverlapsClipped: number;
    warnings: string[];
  };
}
