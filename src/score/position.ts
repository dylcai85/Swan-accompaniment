import type { Score } from './types';

type Meter = Pick<Score, 'ticksPerBar' | 'ticksPerBeat'>;

/** 1-based bar and fractional 1-based beat of a tick. */
export function tickToBarBeat(score: Meter, tick: number): { bar: number; beat: number } {
  const bar = Math.floor(tick / score.ticksPerBar);
  const beat = (tick - bar * score.ticksPerBar) / score.ticksPerBeat;
  return { bar: bar + 1, beat: beat + 1 };
}

/** First tick of a 1-based bar. */
export function barStartTick(score: Meter, bar: number): number {
  return (bar - 1) * score.ticksPerBar;
}

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

/** MIDI note number to scientific pitch name: 60 -> "C4". */
export function midiToName(midi: number): string {
  return `${NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}
