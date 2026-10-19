import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseScore, ScoreParseError, summarizeScore } from '../../src/score/parse';
import { tickToBarBeat } from '../../src/score/position';
import { buildMiniScore, MINI } from '../../tools/mini-score';

const FIXTURE = 'tests/fixtures/mini-score.mid';
const bytes = readFileSync(FIXTURE);
const score = parseScore(bytes, 'mini-score.mid');

describe('mini score fixture', () => {
  it('is up to date with tools/mini-score.ts (run `npm run fixtures:mini`)', () => {
    expect(Buffer.from(buildMiniScore()).equals(bytes)).toBe(true);
  });
});

describe('parseScore on the mini score', () => {
  it('derives meter and bar length from the file', () => {
    expect(score.ppq).toBe(480);
    expect(score.timeSig).toEqual([3, 4]);
    expect(score.ticksPerBeat).toBe(480);
    expect(score.ticksPerBar).toBe(1440);
    expect(score.bars).toBe(MINI.bars);
  });

  it('uses the median tempo as nominal and ignores the tempo map otherwise', () => {
    expect(score.info.tempoEvents).toBe(3);
    expect(score.nominalBpm).toBeCloseTo(MINI.nominalBpm, 3);
  });

  it('maps tracks by name with the expected note counts', () => {
    expect(score.cello).toHaveLength(MINI.celloNotes);
    expect(score.piano1).toHaveLength(MINI.piano1Notes);
    expect(score.piano2).toHaveLength(MINI.piano2Notes);
    expect(score.info.warnings).toEqual([]);
  });

  it('starts the cello at bar 2 beat 1', () => {
    expect(tickToBarBeat(score, score.cello[0]!.tick)).toEqual({ bar: 2, beat: 1 });
  });

  it('clips cello legato overlaps so the line is monophonic', () => {
    expect(score.info.celloOverlapsClipped).toBe(MINI.celloOverlaps);
    for (let i = 0; i + 1 < score.cello.length; i++) {
      const n = score.cello[i]!;
      expect(n.tick + n.durTicks).toBeLessThanOrEqual(score.cello[i + 1]!.tick);
    }
  });

  it('keeps the off-grid piano note', () => {
    expect(score.piano2.some((n) => n.tick === MINI.offGridTick)).toBe(true);
  });

  it('summarizes for the UI', () => {
    expect(summarizeScore(score)).toBe('mini-score.mid · 6 bars · 3/4 · cello 10 · piano 1 72 · piano 2 19 · nominal 80 bpm');
  });
});

describe('parseScore errors', () => {
  it('rejects a non-MIDI file', () => {
    expect(() => parseScore(new TextEncoder().encode('not midi'), 'x.mid')).toThrow(ScoreParseError);
  });
});
