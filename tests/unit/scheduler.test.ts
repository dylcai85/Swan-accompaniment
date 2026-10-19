import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { nominalTicksPerSec, ScoreClock } from '../../src/playback/clock';
import { LOOKAHEAD_SEC, pianoEvents, Scheduler, type PianoVoice } from '../../src/playback/scheduler';
import { barStartTick } from '../../src/score/position';
import { parseScore } from '../../src/score/parse';
import type { Score } from '../../src/score/types';

interface Played {
  midi: number;
  time: number;
  durSec: number;
}

class RecordingVoice implements PianoVoice {
  played: Played[] = [];
  stops: number[] = [];
  noteOn(midi: number, _v: number, time: number, durSec: number): void {
    this.played.push({ midi, time, durSec });
  }
  stopAll(time: number): void {
    this.stops.push(time);
  }
}

const mini = parseScore(readFileSync('tests/fixtures/mini-score.mid'), 'mini-score.mid');

function setup(score: Score) {
  const clock = new ScoreClock(nominalTicksPerSec(score));
  const voice = new RecordingVoice();
  const sched = new Scheduler(pianoEvents(score), clock, voice);
  return { clock, voice, sched };
}

const STEP = 0.025; // the app's pump interval

/** Pump times from `from` to `until` in 25 ms steps (integer-indexed so they don't drift). */
function times(from: number, until: number): number[] {
  const out: number[] = [];
  for (let k = Math.round(from / STEP); k * STEP <= until + 1e-9; k++) out.push(k * STEP);
  return out;
}

/** Pump like the app's 25 ms interval, optionally changing rate at given times. */
function run(sched: Scheduler, until: number, changes: { at: number; rate: number }[] = []): void {
  const pending = [...changes];
  for (const now of times(0, until)) {
    while (pending[0] && now >= pending[0].at) sched.setRate(pending.shift()!.rate, now);
    sched.pump(now);
  }
}

describe('Scheduler', () => {
  const tps = nominalTicksPerSec(mini); // 80 bpm * 480 / 60 = 640 ticks/s
  const events = pianoEvents(mini);

  it('places notes at tick / (ticksPerSec * rate)', () => {
    for (const rate of [1, 0.5]) {
      const { clock, voice, sched } = setup(mini);
      clock.setRate(rate, 0);
      run(sched, 60);
      expect(voice.played).toHaveLength(events.length);
      voice.played.forEach((p, i) => {
        expect(p.time).toBeCloseTo(events[i]!.tick / (tps * rate), 9);
        expect(p.durSec).toBeCloseTo(events[i]!.durTicks / (tps * rate), 9);
      });
    }
  });

  it('never hands a note off before it is within the lookahead window', () => {
    const { voice, sched } = setup(mini);
    const handoffs: { now: number; time: number }[] = [];
    let now = 0;
    sched.voice = { noteOn: (_m, _v, time) => handoffs.push({ now, time }), stopAll: () => {} };
    for (now of times(0, 20)) sched.pump(now);
    for (const h of handoffs) expect(h.time - h.now).toBeLessThan(LOOKAHEAD_SEC);
    expect(voice.played).toHaveLength(0);
  });

  it('hands every note off exactly once, in order, through rate changes', () => {
    const { voice, sched } = setup(mini);
    run(sched, 60, [
      { at: 1.01, rate: 0.6 },
      { at: 2.5, rate: 1.4 },
      { at: 4.2, rate: 0.75 },
    ]);
    expect(voice.played).toHaveLength(events.length);
    expect(voice.played.map((p) => p.midi)).toEqual(events.map((e) => e.midi));
    for (let i = 1; i < voice.played.length; i++) {
      expect(voice.played[i]!.time).toBeGreaterThanOrEqual(voice.played[i - 1]!.time);
    }
  });

  it('applies a rate change from the end of the committed window', () => {
    const { clock, voice, sched } = setup(mini);
    run(sched, 1.0);
    const committed = voice.played.length;
    const anchorTime = 1.0 + LOOKAHEAD_SEC; // horizon of the last pump at now = 1.0
    const anchorTick = anchorTime * tps;
    sched.setRate(0.5, 1.01);
    for (const now of times(1.025, 30)) sched.pump(now);
    expect(clock.rate).toBe(0.5);
    // Notes handed off before the change keep rate-1 times; all later ones follow the new rate.
    voice.played.slice(0, committed).forEach((p, i) => expect(p.time).toBeCloseTo(events[i]!.tick / tps, 9));
    voice.played.slice(committed).forEach((p, j) => {
      const e = events[committed + j]!;
      expect(e.tick).toBeGreaterThanOrEqual(anchorTick - 1e-6);
      expect(p.time).toBeCloseTo(anchorTime + (e.tick - anchorTick) / (tps * 0.5), 9);
    });
  });

  it('skips only piano 2 notes when piano 2 is off', () => {
    const { voice, sched } = setup(mini);
    sched.piano2 = false;
    run(sched, 60);
    expect(voice.played).toHaveLength(mini.piano1.length);
  });

  it('seeks to a bar without stale notes', () => {
    const { voice, sched } = setup(mini);
    run(sched, 1);
    voice.played = [];
    const tick = barStartTick(mini, 4);
    sched.seek(tick, 2);
    for (const now of times(2, 60)) sched.pump(now);
    const expected = events.filter((e) => e.tick >= tick);
    expect(voice.played).toHaveLength(expected.length);
    expect(voice.played[0]!.time).toBeCloseTo(2, 9);
  });
});

const SWAN = 'local/swan.mid';
describe.skipIf(!existsSync(SWAN))(`Scheduler on the real score (${SWAN})`, () => {
  it('hands off all 1177 piano notes exactly once at rate 0.8 with rate changes', () => {
    const swan = parseScore(readFileSync(SWAN), 'swan.mid');
    const { clock, voice, sched } = setup(swan);
    clock.setRate(0.8, 0);
    run(sched, 400, [
      { at: 30, rate: 1.2 },
      { at: 60, rate: 0.6 },
    ]);
    expect(voice.played).toHaveLength(1177);
  });
});
