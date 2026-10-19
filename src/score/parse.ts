import { Midi } from './midiLib';
import type { Note, Score } from './types';

const DEFAULT_BPM = 120;

export class ScoreParseError extends Error {
  override name = 'ScoreParseError';
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

function toNotes(track: Midi['tracks'][number]): Note[] {
  return track.notes
    .map((n) => ({ tick: n.ticks, durTicks: n.durationTicks, midi: n.midi, velocity: n.velocity }))
    .sort((a, b) => a.tick - b.tick || a.midi - b.midi);
}

/** Make a line monophonic: each note ends no later than the next onset. Returns the number clipped. */
function clipOverlaps(notes: Note[]): number {
  let clipped = 0;
  for (let i = 0; i + 1 < notes.length; i++) {
    const cur = notes[i]!;
    const gap = notes[i + 1]!.tick - cur.tick;
    if (cur.durTicks > gap) {
      cur.durTicks = gap;
      clipped++;
    }
  }
  return clipped;
}

/**
 * Parse a MIDI file into a Score: a cello line plus two piano parts, in ticks.
 * Tracks are found by name ("Cello", "Piano 1", "Piano 2"), else by order of non-empty tracks.
 */
export function parseScore(bytes: ArrayBuffer | Uint8Array, name: string): Score {
  let midi: Midi;
  try {
    midi = new Midi(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
  } catch (err) {
    throw new ScoreParseError(`Not a readable MIDI file: ${err instanceof Error ? err.message : String(err)}`);
  }
  const warnings: string[] = [];
  const ppq = midi.header.ppq;

  const sigs = midi.header.timeSignatures;
  if (sigs.length > 1) throw new ScoreParseError('Multiple time signatures are not supported yet (planned for M8).');
  let timeSig: [number, number] = [4, 4];
  const sig = sigs[0]?.timeSignature;
  if (sig && sig.length >= 2) timeSig = [sig[0]!, sig[1]!];
  else warnings.push('No time signature in file; assuming 4/4.');
  const ticksPerBeat = (ppq * 4) / timeSig[1];
  const ticksPerBar = ticksPerBeat * timeSig[0];

  const bpms = midi.header.tempos.map((t) => t.bpm);
  if (bpms.length === 0) warnings.push(`No tempo events in file; assuming ${DEFAULT_BPM} bpm.`);
  const nominalBpm = bpms.length ? median(bpms) : DEFAULT_BPM;

  const withNotes = midi.tracks.filter((t) => t.notes.length > 0);
  const byName = (re: RegExp) => withNotes.find((t) => re.test(t.name));
  let cello = byName(/cello/i);
  let piano1 = byName(/piano\s*1/i);
  let piano2 = byName(/piano\s*2/i);
  if (!cello || !piano1) {
    warnings.push('Track names not recognized; using track order (cello, piano 1, piano 2).');
    [cello, piano1, piano2] = withNotes;
  }
  if (!cello) throw new ScoreParseError('No tracks with notes found.');

  const celloNotes = toNotes(cello);
  const celloOverlapsClipped = clipOverlaps(celloNotes);
  const piano1Notes = piano1 ? toNotes(piano1) : [];
  const piano2Notes = piano2 ? toNotes(piano2) : [];

  const lastOnset = Math.max(...[celloNotes, piano1Notes, piano2Notes].flatMap((ns) => ns.map((n) => n.tick)));
  const bars = Math.floor(lastOnset / ticksPerBar) + 1;

  return {
    name,
    ppq,
    timeSig,
    ticksPerBar,
    ticksPerBeat,
    nominalBpm,
    bars,
    cello: celloNotes,
    piano1: piano1Notes,
    piano2: piano2Notes,
    info: { tempoEvents: bpms.length, celloOverlapsClipped, warnings },
  };
}

/** One-line summary for the UI and tools. */
export function summarizeScore(s: Score): string {
  return [
    s.name,
    `${s.bars} bars`,
    `${s.timeSig[0]}/${s.timeSig[1]}`,
    `cello ${s.cello.length}`,
    `piano 1 ${s.piano1.length}`,
    `piano 2 ${s.piano2.length}`,
    `nominal ${Math.round(s.nominalBpm)} bpm`,
  ].join(' · ');
}
