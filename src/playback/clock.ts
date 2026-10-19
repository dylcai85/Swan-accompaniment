/**
 * Maps score position (ticks) to audio time (seconds) and back:
 *   tick(t) = anchorTick + rate * ticksPerSec * (t - anchorTime)
 * This is the only place where ticks become seconds.
 */
export class ScoreClock {
  private anchorTick = 0;
  private anchorTime = 0;
  private _rate = 1;

  /** ticksPerSec: score ticks per second at rate 1 (the nominal tempo). */
  constructor(readonly ticksPerSec: number) {}

  get rate(): number {
    return this._rate;
  }

  tickAt(time: number): number {
    return this.anchorTick + (time - this.anchorTime) * this.ticksPerSec * this._rate;
  }

  timeAt(tick: number): number {
    return this.anchorTime + (tick - this.anchorTick) / (this.ticksPerSec * this._rate);
  }

  /** Seconds that a span of ticks lasts at the current rate. */
  duration(ticks: number): number {
    return ticks / (this.ticksPerSec * this._rate);
  }

  /** Change speed from `at` on, keeping the position continuous. */
  setRate(rate: number, at: number): void {
    if (!(rate > 0)) throw new RangeError(`rate must be > 0, got ${rate}`);
    this.anchorTick = this.tickAt(at);
    this.anchorTime = at;
    this._rate = rate;
  }

  /** Put score position `tick` at audio time `at`. */
  seek(tick: number, at: number): void {
    this.anchorTick = tick;
    this.anchorTime = at;
  }
}

/** Ticks per second at the score's nominal tempo (rate 1). */
export function nominalTicksPerSec(score: { nominalBpm: number; ppq: number }): number {
  // Tempo is in quarter notes per minute; PPQ is ticks per quarter.
  return (score.nominalBpm / 60) * score.ppq;
}
