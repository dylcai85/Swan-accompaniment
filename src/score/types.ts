/** A note in score time. Ticks only: seconds exist only at the audio edge (CLAUDE.md). */
export interface Note {
  tick: number;
  durTicks: number;
  midi: number;
  /** 0..1 */
  velocity: number;
}

/** One track of the file. */
export interface Part {
  /** Track name from the file, or "Track N" if it has none. */
  name: string;
  notes: Note[];
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
  /** The first track with notes: the part the soloist plays (sorted by tick, legato overlaps clipped). */
  solo: Part;
  /** Every other track with notes, in file order: played back as the accompaniment. */
  accompaniment: Part[];
  /** Diagnostics from parsing. */
  info: {
    tempoEvents: number;
    soloOverlapsClipped: number;
    /** Percussion tracks are skipped: their note numbers are drum sounds, not pitches. */
    skippedTracks: string[];
    warnings: string[];
  };
}
