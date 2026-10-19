// Runs only where the real score is present (local/swan.mid, never committed). CI skips it.
// Asserts aggregates only: never put the piece's note content in a committed file.
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseScore } from '../../src/score/parse';
import { tickToBarBeat } from '../../src/score/position';

const SWAN = 'local/swan.mid';
const present = existsSync(SWAN);
if (!present) console.log(`SKIP real-score tests: ${SWAN} not found (attach swan.mid; see docs/LOCAL_FILES.md).`);

describe.skipIf(!present)(`real score (${SWAN})`, () => {
  const score = present ? parseScore(readFileSync(SWAN), 'swan.mid') : null!;

  it('has the expected meter and resolution', () => {
    expect(score.ppq).toBe(256);
    expect(score.timeSig).toEqual([6, 4]);
    expect(score.ticksPerBar).toBe(1536);
    expect(score.info.tempoEvents).toBe(44);
    expect(Math.round(score.nominalBpm)).toBe(67);
  });

  it('has 113 cello, 919 piano 1 and 258 piano 2 notes', () => {
    expect(score.cello).toHaveLength(113);
    expect(score.piano1).toHaveLength(919);
    expect(score.piano2).toHaveLength(258);
  });

  it('has 28 bars (the final piano chord starts in bar 28)', () => {
    expect(score.bars).toBe(28);
  });

  it('starts the cello at bar 2 beat 1', () => {
    expect(tickToBarBeat(score, score.cello[0]!.tick)).toEqual({ bar: 2, beat: 1 });
  });

  it('has every cello onset on the sixteenth grid', () => {
    expect(score.cello.every((n) => n.tick % (score.ppq / 4) === 0)).toBe(true);
  });

  it('makes the cello monophonic by clipping its 60 legato overlaps', () => {
    expect(score.info.celloOverlapsClipped).toBe(60);
    for (let i = 0; i + 1 < score.cello.length; i++) {
      expect(score.cello[i]!.tick).toBeLessThan(score.cello[i + 1]!.tick);
      expect(score.cello[i]!.tick + score.cello[i]!.durTicks).toBeLessThanOrEqual(score.cello[i + 1]!.tick);
    }
  });
});
