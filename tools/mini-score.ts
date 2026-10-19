// An original, made-up mini score for tests and CI (the real Swan MIDI is never committed).
// It deliberately differs from the Swan (3/4, PPQ 480, 6 bars) so nothing can be hardcoded,
// and includes the cases the parser must handle: a late cello entry, legato overlaps,
// a repeated pitch, sixteenth figures, and one off-grid (rolled) piano note.
import { Midi } from '../src/score/midiLib';

const PPQ = 480; // @tonejs/midi's writer default
const BAR = PPQ * 3;
const Q = PPQ;
const S = PPQ / 4;

/** Cello line: [bar, beat (1-based), midi, beats long, overlap ticks into the next note]. */
const CELLO: [number, number, number, number, number][] = [
  [2, 1, 62, 1, 10], // D4, overlaps E4
  [2, 2, 64, 1, 0],
  [2, 3, 66, 1, 30], // F#4, overlaps A4
  [3, 1, 69, 3, 0],
  [4, 1, 69, 1, 0], // repeated A4
  [4, 2, 67, 1, 0],
  [4, 3, 66, 1, 0],
  [5, 1, 64, 2, 0],
  [5, 3, 62, 1, 15], // D4, overlaps the repeated D4
  [6, 1, 62, 3, 0],
];

/** One chord per bar (root, third, fifth), used for both piano parts. */
const CHORDS = [
  [50, 54, 57],
  [50, 54, 57],
  [43, 47, 50],
  [45, 49, 52],
  [47, 50, 54],
  [50, 54, 57],
] as const;

export const MINI = {
  ppq: PPQ,
  timeSig: [3, 4] as [number, number],
  ticksPerBar: BAR,
  tempos: [72, 80, 96],
  nominalBpm: 80,
  bars: 6,
  celloNotes: CELLO.length,
  celloOverlaps: CELLO.filter((c) => c[4] > 0).length,
  piano1Notes: CHORDS.length * 12,
  piano2Notes: CHORDS.length * 3 + 1,
  offGridTick: 5 * BAR + 37,
};

export function buildMiniScore(): Uint8Array {
  const midi = new Midi();
  midi.header.name = 'mini-score';
  midi.header.timeSignatures.push({ ticks: 0, timeSignature: MINI.timeSig, measures: 0 });
  MINI.tempos.forEach((bpm, i) => midi.header.tempos.push({ ticks: i * 2 * BAR, bpm }));
  midi.header.update();

  const cello = midi.addTrack();
  cello.name = 'Cello';
  for (const [bar, beat, note, beats, overlap] of CELLO) {
    cello.addNote({ midi: note, ticks: (bar - 1) * BAR + (beat - 1) * Q, durationTicks: beats * Q + overlap, velocity: 0.7 });
  }

  const piano1 = midi.addTrack();
  piano1.name = 'Piano 1';
  piano1.channel = 1;
  CHORDS.forEach((chord, b) => {
    for (let i = 0; i < 12; i++) {
      const note = chord[i % 3]! + 12 * (1 + Math.floor(i / 3) % 2);
      piano1.addNote({ midi: note, ticks: b * BAR + i * S, durationTicks: S, velocity: 0.5 });
    }
  });

  const piano2 = midi.addTrack();
  piano2.name = 'Piano 2';
  piano2.channel = 2;
  CHORDS.forEach((chord, b) => {
    for (const note of chord) piano2.addNote({ midi: note - 12, ticks: b * BAR, durationTicks: BAR, velocity: 0.6 });
  });
  piano2.addNote({ midi: 69, ticks: MINI.offGridTick, durationTicks: BAR - 37, velocity: 0.6 }); // rolled top note

  return midi.toArray();
}
