// Offline render: drives the real scheduler with stepped `now` values into an OfflineAudioContext.
// Used by the e2e test to check note onsets in rendered audio (CLAUDE.md: no speakers in the sandbox).
import type { Score } from '../score/types';
import { nominalTicksPerSec, ScoreClock } from './clock';
import { pianoEvents, Scheduler, type PianoVoice } from './scheduler';
import { OscVoice } from './voices';

export interface RenderOptions {
  seconds: number;
  sampleRate?: number;
  piano2?: boolean;
  /** Rate changes applied at the first pump at or after `at` seconds. */
  rateChanges?: { at: number; rate: number }[];
}

export interface RenderResult {
  sampleRate: number;
  /** Onset times the scheduler handed to the voice (seconds). */
  expected: number[];
  /** Onsets detected in the rendered audio (seconds). */
  detected: number[];
}

export async function renderOffline(score: Score, opts: RenderOptions): Promise<RenderResult> {
  const sampleRate = opts.sampleRate ?? 22050;
  const ctx = new OfflineAudioContext(1, Math.ceil(opts.seconds * sampleRate), sampleRate);
  const osc = new OscVoice(ctx, ctx.destination);
  const expected: number[] = [];
  const voice: PianoVoice = {
    noteOn(midi, velocity, time, durSec) {
      expected.push(time);
      osc.noteOn(midi, velocity, time, durSec);
    },
    stopAll: (time) => osc.stopAll(time),
  };
  const sched = new Scheduler(pianoEvents(score), new ScoreClock(nominalTicksPerSec(score)), voice);
  sched.piano2 = opts.piano2 ?? true;
  const pending = [...(opts.rateChanges ?? [])].sort((a, b) => a.at - b.at);
  for (let k = 0; k * 0.025 < opts.seconds; k++) {
    const now = k * 0.025;
    while (pending[0] && now >= pending[0].at) sched.setRate(pending.shift()!.rate, now);
    sched.pump(now);
  }
  const buffer = await ctx.startRendering();
  return {
    sampleRate,
    expected: expected.filter((t) => t < opts.seconds - 0.05),
    detected: detectOnsets(buffer.getChannelData(0), sampleRate),
  };
}

/** Onsets as sharp rises in short-window RMS. Good enough for the oscillator voice's clean attacks. */
export function detectOnsets(samples: Float32Array, sampleRate: number): number[] {
  const hop = Math.max(1, Math.round(sampleRate * 0.001));
  const win = hop * 2;
  const rms: number[] = [];
  for (let i = 0; i + win <= samples.length; i += hop) {
    let sum = 0;
    for (let j = i; j < i + win; j++) sum += samples[j]! * samples[j]!;
    rms.push(Math.sqrt(sum / win));
  }
  const peak = Math.max(...rms);
  const onsets: number[] = [];
  let last = -Infinity;
  for (let k = 4; k < rms.length; k++) {
    const rising = rms[k]! > 0.1 * peak && rms[k]! > 1.8 * rms[k - 4]!;
    const t = (k * hop) / sampleRate;
    if (rising && t - last > 0.05) {
      // Back up to where the rise began.
      let s = k;
      while (s > 0 && rms[s - 1]! < rms[s]! && rms[s - 1]! > 0.02 * peak) s--;
      onsets.push((s * hop) / sampleRate);
      last = t;
    }
  }
  return onsets;
}
