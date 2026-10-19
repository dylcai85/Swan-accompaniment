// Microphone capture: getUserMedia -> AudioWorklet -> analysis frames on the main thread.
// The mic never reaches the speakers and never triggers the piano (CLAUDE.md).
import { debug } from '../debug';

export const CHUNK_SIZE = 1024;

export interface MicInput {
  deviceId: string;
  label: string;
  /** The mic's own settings as reported by the browser (sample rate etc.), for diagnostics. */
  settings: () => string;
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
 * Open the mic with all browser processing off (hard rule 3) and call `onFrame` with the
 * latest `frameSize` samples every CHUNK_SIZE samples. `frame` is reused between calls.
 */
export async function startMic(
  ctx: AudioContext,
  frameSize: number,
  onFrame: (frame: Float32Array, chunk: Float32Array) => void,
  deviceId?: string,
): Promise<MicInput> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      // A preference, not a requirement: if that mic is gone, fall back to the default one.
      deviceId: deviceId ? { ideal: deviceId } : undefined,
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      channelCount: 1,
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
