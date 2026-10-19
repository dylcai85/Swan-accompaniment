// Generates the fake-microphone WAV for tests/e2e/mic.spec.ts (gitignored, never committed).
import { mkdirSync, writeFileSync } from 'node:fs';

export const FAKE_MIC_WAV = 'fixtures/synthetic/fake-mic.wav';
const SR = 48000;

function segment(seconds: number, freq: number, harmonics: number): Float32Array {
  const out = new Float32Array(Math.round(SR * seconds));
  for (let i = 0; i < out.length; i++) {
    let v = 0;
    for (let h = 1; h <= harmonics; h++) v += Math.sin((2 * Math.PI * freq * h * i) / SR) / h;
    const fade = Math.min(1, i / 480, (out.length - i) / 480);
    out[i] = freq > 0 ? 0.3 * v * fade : 0;
  }
  return out;
}

function wav(samples: Float32Array): Buffer {
  const b = Buffer.alloc(44 + samples.length * 2);
  b.write('RIFF', 0);
  b.writeUInt32LE(36 + samples.length * 2, 4);
  b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); // PCM
  b.writeUInt16LE(1, 22); // mono
  b.writeUInt32LE(SR, 24);
  b.writeUInt32LE(SR * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((s, i) => b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 32767), 44 + i * 2));
  return b;
}

export default function globalSetup(): void {
  // A3 sine, silence, D4 sawtooth-ish (8 harmonics), silence; Chromium loops the file.
  const parts = [segment(1.5, 220, 1), segment(1, 0, 1), segment(1.5, 293.66, 8), segment(1, 0, 1)];
  const all = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    all.set(p, o);
    o += p.length;
  }
  mkdirSync('fixtures/synthetic', { recursive: true });
  writeFileSync(FAKE_MIC_WAV, wav(all));
}
