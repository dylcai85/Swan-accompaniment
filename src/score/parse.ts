import { Midi } from './midiLib';
import type { Note, Part, Score } from './types';

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

/** Legato overlaps: each note ends no later than the next later onset. Returns the number clipped. */
function clipOverlaps(notes: Note[]): number {
  let clipped = 0;
  for (let i = 0; i + 1 < notes.length; i++) {
    const cur = notes[i]!;
    const gap = notes[i + 1]!.tick - cur.tick;
    // gap 0 is a chord (e.g. a double stop): leave it alone.
    if (gap > 0 && cur.durTicks > gap) {
      cur.durTicks = gap;
      clipped++;
    }
  }
  return clipped;
}

/**
 * Parse a MIDI file into a Score, in ticks. The first track with notes is the solo, whatever it
 * is called or whichever instrument it is; every other track with notes is accompaniment.
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

  const skippedTracks: string[] = [];
  const parts: Part[] = [];
  midi.tracks.forEach((t, i) => {
    if (t.notes.length === 0) return;
    const partName = t.name.trim() || `Track ${i + 1}`;
    if (t.instrument.percussion) skippedTracks.push(partName);
    else parts.push({ name: partName, notes: toNotes(t) });
  });
  const [solo, ...accompaniment] = parts;
  if (!solo) throw new ScoreParseError('No tracks with notes found.');
  if (accompaniment.length === 0) warnings.push('Only one track with notes: there is no accompaniment to play.');
  const soloOverlapsClipped = clipOverlaps(solo.notes);

  const lastOnset = Math.max(...parts.flatMap((p) => p.notes.map((n) => n.tick)));
  const bars = Math.floor(lastOnset / ticksPerBar) + 1;

  return {
    name,
    ppq,
    timeSig,
    ticksPerBar,
    ticksPerBeat,
    nominalBpm,
    bars,
    solo,
    accompaniment,
    info: { tempoEvents: bpms.length, soloOverlapsClipped, skippedTracks, warnings },
  };
}

/** One-line summary for the UI and tools. */
export function summarizeScore(s: Score): string {
  return [
    s.name,
    `${s.bars} bars`,
    `${s.timeSig[0]}/${s.timeSig[1]}`,
    `solo: ${s.solo.name} (${s.solo.notes.length} notes)`,
    `accompaniment: ${s.accompaniment.length} ${s.accompaniment.length === 1 ? 'track' : 'tracks'} (${s.accompaniment.reduce((n, p) => n + p.notes.length, 0)} notes)`,
    `nominal ${Math.round(s.nominalBpm)} bpm`,
  ].join(' · ');
}
