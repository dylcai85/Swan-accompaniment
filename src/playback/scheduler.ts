import type { ScoreClock } from './clock';
import type { Score } from '../score/types';

export interface PianoEvent {
  tick: number;
  durTicks: number;
  midi: number;
  velocity: number;
  /** Index into `score.accompaniment`. */
  part: number;
}

export interface PianoVoice {
  /** Play a note starting at audio time `time` (seconds) for `durSec`. */
  noteOn(midi: number, velocity: number, time: number, durSec: number): void;
  /** Silence everything sounding or already scheduled, from `time`. */
  stopAll(time: number): void;
}

export const LOOKAHEAD_SEC = 0.12;

/** All accompaniment tracks merged into one list sorted by tick. */
export function pianoEvents(score: Score): PianoEvent[] {
  return score.accompaniment
    .flatMap((p, part) => p.notes.map((n): PianoEvent => ({ ...n, part })))
    .sort((a, b) => a.tick - b.tick || a.part - b.part);
}

/** Index of the first event at or after `tick`. */
function firstAtOrAfter(events: PianoEvent[], tick: number): number {
  let lo = 0;
  let hi = events.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (events[mid]!.tick < tick) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Lookahead scheduler. `pump(now)` hands each event whose time falls before `now + lookahead`
 * to the voice, exactly once and in order. Pure: the caller supplies `now`.
 *
 * Rate changes take effect at the end of the window already handed off (`committedUntil`),
 * so notes given to the voice never move, and every later note uses the new rate. That keeps
 * times monotonic with no doubled or dropped notes, at the cost of hearing a change up to
 * one lookahead (~120 ms) late.
 */
export class Scheduler {
  private cursor = 0;
  private committedUntil = -Infinity;
  /** Accompaniment parts (indices) that are switched off. */
  readonly muted = new Set<number>();
  handedOff = 0;

  constructor(
    readonly events: PianoEvent[],
    readonly clock: ScoreClock,
    public voice: PianoVoice,
    readonly lookahead = LOOKAHEAD_SEC,
  ) {}

  get done(): boolean {
    return this.cursor >= this.events.length;
  }

  pump(now: number): void {
    const horizon = now + this.lookahead;
    while (this.cursor < this.events.length) {
      const e = this.events[this.cursor]!;
      const time = this.clock.timeAt(e.tick);
      if (time >= horizon) break;
      this.cursor++;
      if (this.muted.has(e.part)) continue;
      this.voice.noteOn(e.midi, e.velocity, Math.max(time, now), this.clock.duration(e.durTicks));
      this.handedOff++;
    }
    this.committedUntil = Math.max(this.committedUntil, horizon);
  }

  setRate(rate: number, now: number): void {
    this.clock.setRate(rate, Math.max(now, this.committedUntil));
  }

  /** Continue from score position `tick`, placed at audio time `at`. The caller silences the voice. */
  seek(tick: number, at: number): void {
    this.clock.seek(tick, at);
    this.cursor = firstAtOrAfter(this.events, tick);
    this.committedUntil = -Infinity;
  }
}
