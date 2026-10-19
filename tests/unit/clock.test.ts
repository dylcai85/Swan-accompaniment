import { describe, expect, it } from 'vitest';
import { nominalTicksPerSec, ScoreClock } from '../../src/playback/clock';

describe('ScoreClock', () => {
  it('converts ticks and time at the nominal tempo', () => {
    const c = new ScoreClock(nominalTicksPerSec({ nominalBpm: 60, ppq: 256 })); // 256 ticks/s
    expect(c.timeAt(512)).toBe(2);
    expect(c.tickAt(1.5)).toBe(384);
  });

  it('keeps position continuous across a rate change', () => {
    const c = new ScoreClock(100);
    c.setRate(0.5, 2);
    expect(c.tickAt(2)).toBe(200);
    expect(c.tickAt(4)).toBe(300);
    expect(c.timeAt(300)).toBe(4);
    c.setRate(1.5, 4);
    expect(c.tickAt(5)).toBe(450);
  });

  it('seeks to a tick at a given time', () => {
    const c = new ScoreClock(100);
    c.setRate(2, 0);
    c.seek(1000, 10);
    expect(c.tickAt(10)).toBe(1000);
    expect(c.timeAt(1200)).toBe(11);
  });

  it('timeAt and tickAt are inverse', () => {
    const c = new ScoreClock(437.3);
    c.setRate(0.83, 1.7);
    for (const t of [0, 1.7, 3.33, 100]) expect(c.timeAt(c.tickAt(t))).toBeCloseTo(t, 9);
  });

  it('rejects a non-positive rate', () => {
    expect(() => new ScoreClock(100).setRate(0, 0)).toThrow(RangeError);
  });
});
