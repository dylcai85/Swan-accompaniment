import { debug } from '../debug';
import { barStartTick, tickToBarBeat } from '../score/position';
import type { Score } from '../score/types';
import { nominalTicksPerSec, ScoreClock } from './clock';
import { LOOKAHEAD_SEC, pianoEvents, Scheduler } from './scheduler';
import { createSamplerVoice, OscVoice } from './voices';

const PUMP_MS = 25;
/** Gap before the first note after play/seek, so the scheduler is ahead of the audio clock. */
const START_DELAY = 0.05;
const FADE = 0.02;

export type PlayerState = 'paused' | 'playing';
export type VoiceStatus = 'loading' | 'sampler' | 'synth-fallback';

/** Plays a score's piano parts on an AudioContext: score clock + lookahead scheduler + voice. */
export class Player {
  private readonly master: GainNode;
  private readonly sched: Scheduler;
  private readonly lastTick: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private pausedTick = 0;
  state: PlayerState = 'paused';
  voiceStatus: VoiceStatus = 'loading';
  /** Settles once the piano sound is decided: samples loaded, or the synth fallback. */
  readonly ready: Promise<void>;
  onChange: () => void = () => {};

  constructor(
    private readonly ctx: AudioContext,
    readonly score: Score,
  ) {
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    const events = pianoEvents(score);
    this.lastTick = Math.max(0, ...events.map((e) => e.tick + e.durTicks));
    this.sched = new Scheduler(events, new ScoreClock(nominalTicksPerSec(score)), new OscVoice(ctx, this.master));
    this.ready = createSamplerVoice(ctx, this.master).then(
      (voice) => {
        this.sched.voice.stopAll(ctx.currentTime);
        this.sched.voice = voice;
        this.voiceStatus = 'sampler';
        this.onChange();
      },
      (err: unknown) => {
        console.warn('Piano samples unavailable, using simple synth:', err);
        this.voiceStatus = 'synth-fallback';
        this.onChange();
      },
    );
    this.publish();
  }

  get rate(): number {
    return this.sched.clock.rate;
  }

  get piano2(): boolean {
    return this.sched.piano2;
  }

  set piano2(on: boolean) {
    this.sched.piano2 = on;
  }

  /** Current score position (ticks). */
  tick(): number {
    return this.state === 'playing' ? Math.max(0, this.sched.clock.tickAt(this.ctx.currentTime)) : this.pausedTick;
  }

  play(): void {
    if (this.state === 'playing') return;
    if (this.pausedTick >= this.lastTick) this.pausedTick = 0;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(1, now, FADE / 3);
    this.sched.seek(this.pausedTick, now + START_DELAY);
    this.state = 'playing';
    this.timer = setInterval(() => this.pump(), PUMP_MS);
    this.pump();
  }

  pause(): void {
    if (this.state !== 'playing') return;
    const now = this.ctx.currentTime;
    this.pausedTick = Math.min(this.tick(), this.lastTick);
    this.stop(now);
    this.state = 'paused';
    this.publish();
  }

  /** Jump to the start of a 1-based bar. Keeps playing if playing. */
  seekBar(bar: number): void {
    const clamped = Math.min(Math.max(1, Math.round(bar)), this.score.bars);
    const tick = barStartTick(this.score, clamped);
    if (this.state === 'playing') {
      const now = this.ctx.currentTime;
      // Mute while already-scheduled notes (up to one lookahead) would sound, then resume.
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setTargetAtTime(0, now, FADE / 3);
      this.sched.voice.stopAll(now);
      const resumeAt = now + LOOKAHEAD_SEC + FADE * 2;
      this.master.gain.setTargetAtTime(1, resumeAt - FADE, FADE / 3);
      this.sched.seek(tick, resumeAt);
    } else {
      this.pausedTick = tick;
    }
    this.publish();
  }

  setRate(rate: number): void {
    this.sched.setRate(rate, this.ctx.currentTime);
    this.publish();
  }

  private stop(now: number): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(0, now, FADE / 3);
    this.sched.voice.stopAll(now);
  }

  private pump(): void {
    this.sched.pump(this.ctx.currentTime);
    if (this.sched.done && this.tick() >= this.lastTick) {
      this.stop(this.ctx.currentTime);
      this.state = 'paused';
      this.pausedTick = this.lastTick;
    }
    this.publish();
  }

  private publish(): void {
    const tick = this.tick();
    const { bar, beat } = tickToBarBeat(this.score, tick);
    debug.playback = {
      state: this.state,
      tick,
      bar,
      beat,
      rate: this.rate,
      handedOff: this.sched.handedOff,
      voice: this.voiceStatus,
    };
    this.onChange();
  }
}
