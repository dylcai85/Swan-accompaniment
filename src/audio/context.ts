export interface AudioInfo {
  sampleRate: number;
  /** Seconds; null when the browser does not report it. */
  baseLatency: number | null;
  outputLatency: number | null;
}

let ctx: AudioContext | null = null;

/** Create or resume the shared AudioContext. Call only from a user gesture (autoplay policy). */
export async function getAudioContext(): Promise<AudioContext> {
  ctx ??= new AudioContext({ latencyHint: 'interactive' });
  if (ctx.state !== 'running') await ctx.resume();
  return ctx;
}

/** Start audio (from a user gesture) and report its sample rate and latency. */
export async function startAudio(): Promise<AudioInfo> {
  const ctx = await getAudioContext();
  return {
    sampleRate: ctx.sampleRate,
    baseLatency: Number.isFinite(ctx.baseLatency) ? ctx.baseLatency : null,
    outputLatency: Number.isFinite(ctx.outputLatency) ? ctx.outputLatency : null,
  };
}
