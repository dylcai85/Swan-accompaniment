import { describe, expect, it } from 'vitest';
import { barStartTick, midiToName, tickToBarBeat } from '../../src/score/position';

const SIX_FOUR = { ticksPerBar: 1536, ticksPerBeat: 256 };
const SIX_EIGHT = { ticksPerBar: 720, ticksPerBeat: 120 }; // PPQ 240, beat = eighth

describe('tickToBarBeat', () => {
  it('maps bar boundaries and beats in 6/4', () => {
    expect(tickToBarBeat(SIX_FOUR, 0)).toEqual({ bar: 1, beat: 1 });
    expect(tickToBarBeat(SIX_FOUR, 1535)).toEqual({ bar: 1, beat: 1 + 1535 / 256 });
    expect(tickToBarBeat(SIX_FOUR, 1536)).toEqual({ bar: 2, beat: 1 });
    expect(tickToBarBeat(SIX_FOUR, 1536 + 64)).toEqual({ bar: 2, beat: 1.25 });
  });

  it('uses the denominator for the beat unit', () => {
    expect(tickToBarBeat(SIX_EIGHT, 720 + 360)).toEqual({ bar: 2, beat: 4 });
  });

  it('round-trips with barStartTick', () => {
    for (const bar of [1, 2, 17, 28]) expect(tickToBarBeat(SIX_FOUR, barStartTick(SIX_FOUR, bar))).toEqual({ bar, beat: 1 });
  });
});

describe('midiToName', () => {
  it('uses scientific pitch notation', () => {
    expect(midiToName(60)).toBe('C4');
    expect(midiToName(69)).toBe('A4');
    expect(midiToName(52)).toBe('E3');
    expect(midiToName(66)).toBe('F#4');
    expect(midiToName(21)).toBe('A0');
  });
});
