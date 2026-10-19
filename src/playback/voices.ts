import { midiToName } from '../score/position';
import type { PianoVoice } from './scheduler';

const SALAMANDER_URL = 'https://tonejs.github.io/audio/salamander/';
const SAMPLE_LOAD_TIMEOUT_MS = 30_000;

/** Salamander samples, one every minor third (Tone.js's standard set); the Sampler repitches between them. */
function salamanderUrls(): Record<string, string> {
  const urls: Record<string, string> = { A0: 'A0.mp3', C8: 'C8.mp3' };
  for (let octave = 1; octave <= 7; octave++) {
    for (const [name, file] of [['C', 'C'], ['D#', 'Ds'], ['F#', 'Fs'], ['A', 'A']] as const) {
      urls[`${name}${octave}`] = `${file}${octave}.mp3`;
    }
  }
  return urls;
}

/** Simple synth: plain Web Audio, no samples. Used in tests, offline renders, and until samples load. */
export class OscVoice implements PianoVoice {
  private readonly active = new Set<{ osc: OscillatorNode; gain: GainNode }>();

  constructor(
    private readonly ctx: BaseAudioContext,
    private readonly out: AudioNode,
  ) {}

  noteOn(midi: number, velocity: number, time: number, durSec: number): void {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = 440 * 2 ** ((midi - 69) / 12);
    const peak = 0.15 * velocity;
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(peak, time + 0.005);
    gain.gain.setTargetAtTime(0, time + 0.005, 0.1); // piano-like decay
    gain.gain.setTargetAtTime(0, time + durSec, 0.03); // release at note end
    osc.connect(gain).connect(this.out);
    const node = { osc, gain };
    this.active.add(node);
    osc.onended = () => {
      gain.disconnect();
      this.active.delete(node);
    };
    osc.start(time);
    osc.stop(time + durSec + 0.3);
  }

  stopAll(time: number): void {
    for (const { osc, gain } of this.active) {
      gain.gain.cancelScheduledValues(time);
      gain.gain.setTargetAtTime(0, time, 0.01);
      osc.stop(time + 0.1);
    }
  }
}

/**
 * Salamander grand piano through Tone's Sampler, with light reverb, into `out`.
 * Tone is loaded on demand and runs on our AudioContext; Tone's Transport is never used.
 */
export async function createSamplerVoice(ctx: AudioContext, out: AudioNode): Promise<PianoVoice> {
  const Tone = await import('tone');
  Tone.setContext(ctx);
  const reverb = new Tone.Reverb({ decay: 2.5, wet: 0.25 });
  reverb.connect(out);
  await reverb.ready;

  const sampler = await new Promise<InstanceType<typeof Tone.Sampler>>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('piano samples took too long to load')), SAMPLE_LOAD_TIMEOUT_MS);
    const s: InstanceType<typeof Tone.Sampler> = new Tone.Sampler({
      urls: salamanderUrls(),
      baseUrl: SALAMANDER_URL,
      release: 1,
      onload: () => {
        clearTimeout(timer);
        resolve(s);
      },
      onerror: (err) => {
        clearTimeout(timer);
        reject(err);
      },
    }).connect(reverb);
  });

  return {
    noteOn(midi, velocity, time, durSec) {
      sampler.triggerAttackRelease(midiToName(midi), durSec, time, velocity);
    },
    stopAll(time) {
      sampler.releaseAll(time);
    },
  };
}
