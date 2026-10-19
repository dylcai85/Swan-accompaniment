// Prints the structure of a score MIDI: header facts, then a bar-by-bar table.
// Output is for the terminal only: never save it into the repo (it reproduces the piece's notes).
import { existsSync, readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { parseScore } from '../src/score/parse';
import { midiToName, tickToBarBeat } from '../src/score/position';
import type { Note, Score } from '../src/score/types';

const path = process.argv[2] ?? 'local/swan.mid';
if (!existsSync(path)) {
  console.log(`SKIP: ${path} not found. Attach swan.mid to this session and place it at local/swan.mid (see docs/LOCAL_FILES.md).`);
  process.exit(0);
}

const score = parseScore(readFileSync(path), basename(path));
const sixteenth = score.ppq / 4;

function range(notes: Note[]): string {
  if (notes.length === 0) return '-';
  const ms = notes.map((n) => n.midi);
  return `${midiToName(Math.min(...ms))}-${midiToName(Math.max(...ms))}`;
}

function trackLine(label: string, notes: Note[]): string {
  const first = notes[0] ? tickToBarBeat(score, notes[0].tick) : null;
  const offGrid = new Set(notes.filter((n) => n.tick % sixteenth !== 0).map((n) => n.tick)).size;
  return `${label.padEnd(8)} ${String(notes.length).padStart(4)} notes  ${range(notes).padEnd(8)} first onset ${
    first ? `bar ${first.bar} beat ${first.beat}` : '-'
  }  off-16th-grid onsets ${offGrid}`;
}

function inBar(notes: Note[], bar: number): Note[] {
  return notes.filter((n) => tickToBarBeat(score, n.tick).bar === bar);
}

function fmtBeat(beat: number): string {
  return Number.isInteger(beat) ? String(beat) : beat.toFixed(2);
}

function print(s: Score): void {
  console.log(`${s.name}: PPQ ${s.ppq}, ${s.timeSig[0]}/${s.timeSig[1]}, ${s.ticksPerBar} ticks/bar, ${s.bars} bars`);
  console.log(`tempo events ${s.info.tempoEvents} (ignored), nominal ${s.nominalBpm.toFixed(1)} bpm (median)`);
  console.log(trackLine('cello', s.cello) + `  overlaps clipped ${s.info.celloOverlapsClipped}`);
  console.log(trackLine('piano 1', s.piano1));
  console.log(trackLine('piano 2', s.piano2));
  for (const w of s.info.warnings) console.log(`warning: ${w}`);
  console.log('');
  console.log('bar | piano1 | piano2 | cello (beat:note)');
  for (let bar = 1; bar <= s.bars; bar++) {
    const cello = inBar(s.cello, bar)
      .map((n) => `${fmtBeat(tickToBarBeat(s, n.tick).beat)}:${midiToName(n.midi)}`)
      .join(' ');
    console.log(
      `${String(bar).padStart(3)} | ${String(inBar(s.piano1, bar).length).padStart(6)} | ${String(inBar(s.piano2, bar).length).padStart(6)} | ${cello}`,
    );
  }
}

print(score);
