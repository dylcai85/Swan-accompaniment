// Microphone capture: getUserMedia -> AudioWorklet -> analysis frames on the main thread.
// The mic never reaches the speakers and never triggers the piano (CLAUDE.md).
import { debug } from '../debug';

export const CHUNK_SIZE = 1024;

/**
 * Ways to open the mic, most accurate first. Hard rule 3 wants all processing off, but on some
 * Macs Chrome delivers pure digital silence in that mode while wired headphones are plugged in;
 * the later modes are fallbacks the panel tries only when an earlier one sends exact zeros.
 */
export const MIC_MODES = [
  { id: 'raw-mono', label: 'raw (best for pitch)', echoCancellation: false, channelCount: 1 },
  { id: 'raw', label: 'raw, device channels', echoCancellation: false, channelCount: undefined },
  { id: 'echo-cancel', label: 'with echo cancellation (fallback)', echoCancellation: true, channelCount: undefined },
] as const;
export type MicMode = (typeof MIC_MODES)[number];

export interface MicInput {
  deviceId: string;
  label: string;
  /** The mic's own settings as reported by the browser (sample rate etc.), for diagnostics. */
  settings: () => string;
  mode: MicMode;
  /** Called if the device goes away (unplugged, or the OS switched it off). */
  onEnded: () => void;
  /** Stop capture and release the microphone. */
  stop(): void;
}

export async function listMics(): Promise<MediaDeviceInfo[]> {
  const all = await navigator.mediaDevices.enumerateDevices();
  return all.filter((d) => d.kind === 'audioinput');
}

/**
 * Open the mic (noise suppression and auto gain always off; see MIC_MODES) and call `onFrame`
 * with the latest `frameSize` samples every CHUNK_SIZE samples. `frame` is reused between calls.
 */
export async function startMic(
  ctx: AudioContext,
  frameSize: number,
  onFrame: (frame: Float32Array, chunk: Float32Array) => void,
  deviceId?: string,
  mode: MicMode = MIC_MODES[0],
): Promise<MicInput> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      // A preference, not a requirement: if that mic is gone, fall back to the default one.
      deviceId: deviceId ? { ideal: deviceId } : undefined,
      echoCancellation: mode.echoCancellation,
      noiseSuppression: false,
      autoGainControl: false,
      ...(mode.channelCount ? { channelCount: mode.channelCount } : {}),
    },
  });
  const workletUrl = new URL('./capture.worklet.js', import.meta.url);
  debug.workletUrl = workletUrl.href;
  await ctx.audioWorklet.addModule(workletUrl);
  const source = ctx.createMediaStreamSource(stream);
  const node = new AudioWorkletNode(ctx, 'capture', {
    numberOfInputs: 1,
    numberOfOutputs: 0,
    channelCount: 1,
    channelCountMode: 'explicit',
    processorOptions: { chunkSize: CHUNK_SIZE },
  });
  source.connect(node);

  const frame = new Float32Array(frameSize);
  node.port.onmessage = (e: MessageEvent<Float32Array>) => {
    const chunk = e.data;
    frame.copyWithin(0, chunk.length);
    frame.set(chunk, frameSize - chunk.length);
    onFrame(frame, chunk);
  };

  const track = stream.getAudioTracks()[0];
  const input: MicInput = {
    deviceId: track?.getSettings().deviceId ?? '',
    label: track?.label ?? 'microphone',
    mode,
    settings: () => {
      const s = track?.getSettings();
      if (!s) return 'no track';
      return `${track!.readyState}${track!.muted ? ', muted' : ''}${s.sampleRate ? `, ${s.sampleRate} Hz` : ''}`;
    },
    onEnded: () => {},
    stop() {
      node.port.onmessage = null;
      source.disconnect();
      node.disconnect();
      for (const t of stream.getTracks()) t.stop();
    },
  };
  if (track) track.onended = () => input.onEnded();
  return input;
}
