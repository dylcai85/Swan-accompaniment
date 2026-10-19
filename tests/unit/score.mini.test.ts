import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Midi } from '../../src/score/midiLib';
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

  it('takes the first track as the solo and the rest as accompaniment', () => {
    expect(score.solo.name).toBe('Cello');
    expect(score.solo.notes).toHaveLength(MINI.celloNotes);
    expect(score.accompaniment.map((p) => p.name)).toEqual(['Piano 1', 'Piano 2']);
    expect(score.accompaniment[0]!.notes).toHaveLength(MINI.piano1Notes);
    expect(score.accompaniment[1]!.notes).toHaveLength(MINI.piano2Notes);
    expect(score.info.warnings).toEqual([]);
  });

  it('starts the solo at bar 2 beat 1', () => {
    expect(tickToBarBeat(score, score.solo.notes[0]!.tick)).toEqual({ bar: 2, beat: 1 });
  });

  it('clips solo legato overlaps so the line is monophonic', () => {
    expect(score.info.soloOverlapsClipped).toBe(MINI.celloOverlaps);
    for (let i = 0; i + 1 < score.solo.notes.length; i++) {
      const n = score.solo.notes[i]!;
      expect(n.tick + n.durTicks).toBeLessThanOrEqual(score.solo.notes[i + 1]!.tick);
    }
  });

  it('keeps the off-grid piano note', () => {
    expect(score.accompaniment[1]!.notes.some((n) => n.tick === MINI.offGridTick)).toBe(true);
  });

  it('summarizes for the UI', () => {
    expect(summarizeScore(score)).toBe('mini-score.mid · 6 bars · 3/4 · solo: Cello (10 notes) · accompaniment: 2 tracks (91 notes) · nominal 80 bpm');
  });
});

describe('parseScore track roles', () => {
  /** A small file with arbitrary track names, an unnamed track and a drum track. */
  function build(): Uint8Array {
    const midi = new Midi();
    midi.header.timeSignatures.push({ ticks: 0, timeSignature: [4, 4], measures: 0 });
    midi.header.update();
    const add = (name: string, channel: number, notes: number[], chord = false) => {
      const t = midi.addTrack();
      t.name = name;
      t.channel = channel;
      notes.forEach((m, i) => t.addNote({ midi: m, ticks: chord ? 0 : i * 480, durationTicks: 480, velocity: 0.7 }));
    };
    add('Violin', 0, [67, 69, 71]);
    add('Strings', 1, [55, 59, 62], true);
    add('Drums', 9, [36, 38, 42]);
    add('', 2, [43, 50]);
    return midi.toArray();
  }

  it('uses the first track as the solo and every other pitched track as accompaniment, whatever their names', () => {
    const s = parseScore(build(), 'other.mid');
    expect(s.solo.name).toBe('Violin');
    expect(s.solo.notes).toHaveLength(3);
    expect(s.accompaniment.map((p) => p.name)).toEqual(['Strings', 'Track 4']);
    expect(s.info.skippedTracks).toEqual(['Drums']);
  });

  it('keeps chords in the solo (only legato overlaps are clipped)', () => {
    const midi = new Midi();
    const t = midi.addTrack();
    t.addNote({ midi: 62, ticks: 0, durationTicks: 480, velocity: 0.7 });
    t.addNote({ midi: 69, ticks: 0, durationTicks: 480, velocity: 0.7 });
    const s = parseScore(midi.toArray(), 'double-stop.mid');
    expect(s.solo.notes.map((n) => n.durTicks)).toEqual([480, 480]);
    expect(s.accompaniment).toEqual([]);
  });
});

describe('parseScore errors', () => {
  it('rejects a non-MIDI file', () => {
    expect(() => parseScore(new TextEncoder().encode('not midi'), 'x.mid')).toThrow(ScoreParseError);
  });
});
