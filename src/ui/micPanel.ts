import { getAudioContext } from '../audio/context';
import { listMics, startMic, type MicInput } from '../audio/mic';
import { debug, type PitchDebug } from '../debug';
import { PitchTracker } from '../dsp/pitch';
import { freqToNote, PitchSmoother } from '../dsp/smooth';

const LOG_SIZE = 200;
const STORED_MIC = 'swan.micDeviceId';
/** Below this level for ~2 s, the selected input is treated as silent (e.g. a headphone jack with no mic). */
const SILENT_DB = -85;

function storedMic(): string {
  try {
    return localStorage.getItem(STORED_MIC) ?? '';
  } catch {
    return '';
  }
}

function storeMic(id: string): void {
  try {
    localStorage.setItem(STORED_MIC, id);
  } catch {
    // Not remembered; harmless.
  }
}
const ms = (s: number) => `${Math.round(s * 1000)} ms`;

/** Microphone: device picker, level meter, live note readout, latency. */
export function mountMicPanel(root: HTMLElement): void {
  root.innerHTML = `
    <section class="mic-panel">
      <button type="button" data-testid="mic-start">Start mic</button>
      <label>Microphone <select data-testid="mic-device"><option value="">Default</option></select></label>
      <div class="meter" aria-hidden="true"><div class="meter-fill" data-testid="mic-meter"></div></div>
      <span data-testid="mic-level-hint" class="hint"></span>
      <p class="note" data-testid="mic-note">—</p>
      <p class="detail" data-testid="mic-detail">Mic off.</p>
      <p class="detail" data-testid="mic-latency"></p>
      <p class="detail" data-testid="mic-diagnostics"></p>
    </section>
  `;
  const q = <T extends HTMLElement>(id: string) => root.querySelector<T>(`[data-testid="${id}"]`)!;
  const startBtn = q<HTMLButtonElement>('mic-start');
  const deviceSelect = q<HTMLSelectElement>('mic-device');
  const meter = q<HTMLDivElement>('mic-meter');
  const levelHint = q<HTMLSpanElement>('mic-level-hint');
  const noteEl = q<HTMLParagraphElement>('mic-note');
  const detail = q<HTMLParagraphElement>('mic-detail');
  const latency = q<HTMLParagraphElement>('mic-latency');
  const diag = q<HTMLParagraphElement>('mic-diagnostics');
  let diagTimer: ReturnType<typeof setInterval> | null = null;
  let lastLevelDb = -Infinity;

  let mic: MicInput | null = null;
  let watchdog: ReturnType<typeof setTimeout> | null = null;
  let frames = 0;
  let silentFrames = 0;
  const log: PitchDebug[] = [];
  debug.pitchLog = log;

  const fillDevices = async (selected: string) => {
    const mics = await listMics();
    deviceSelect.innerHTML = mics
      .map((m, i) => `<option value="${m.deviceId}">${m.label || `Microphone ${i + 1}`}</option>`)
      .join('');
    if (mics.some((m) => m.deviceId === selected)) deviceSelect.value = selected;
  };

  const start = async () => {
    const ctx = await getAudioContext();
    const tracker = new PitchTracker(ctx.sampleRate);
    const smoother = new PitchSmoother();
    latency.textContent =
      `Latency: output ${Number.isFinite(ctx.outputLatency) ? ms(ctx.outputLatency) : 'n/a'} · ` +
      `base ${Number.isFinite(ctx.baseLatency) ? ms(ctx.baseLatency) : 'n/a'} · ` +
      `analysis window ${ms(tracker.frameSize / ctx.sampleRate)} · ${ctx.sampleRate} Hz`;

    frames = 0;
    silentFrames = 0;
    detail.textContent = 'Starting microphone…';
    mic = await startMic(
      ctx,
      tracker.frameSize,
      (frame, chunk) => {
        frames++;
        let sum = 0;
        let peak = 0;
        for (let i = 0; i < chunk.length; i++) {
          sum += chunk[i]! * chunk[i]!;
          peak = Math.max(peak, Math.abs(chunk[i]!));
        }
        const levelDb = 20 * Math.log10(Math.sqrt(sum / chunk.length) + 1e-9);
        lastLevelDb = levelDb;
        meter.style.width = `${Math.max(0, Math.min(100, ((levelDb + 60) / 60) * 100))}%`;
        silentFrames = levelDb < SILENT_DB ? silentFrames + 1 : 0;
        levelHint.textContent =
          peak > 0.99
            ? 'Clipping: move the mic back'
            : silentFrames > 90 // ~2 s
              ? 'This microphone is sending silence: pick another in the Microphone list'
              : levelDb < -45
                ? 'Very quiet'
                : '';

        const r = tracker.analyze(frame);
        const freq = smoother.push(r.freq, r.voiced);
        const note = freq > 0 ? freqToNote(freq) : null;
        const reading: PitchDebug = {
          t: ctx.currentTime,
          freq,
          name: note?.name ?? '',
          cents: note?.cents ?? 0,
          confidence: r.confidence,
          voiced: freq > 0,
          levelDb,
        };
        debug.pitch = reading;
        log.push(reading);
        if (log.length > LOG_SIZE) log.shift();

        if (note) {
          const c = Math.round(note.cents);
          noteEl.textContent = `${note.name} ${c >= 0 ? '+' : '−'}${Math.abs(c)}¢`;
          detail.textContent = `${freq.toFixed(1)} Hz · confidence ${r.confidence.toFixed(2)}`;
        } else {
          noteEl.textContent = '—';
          detail.textContent = `Mic on: ${mic?.label ?? ''} · level ${Math.round(levelDb)} dB · no clear pitch yet: sing or play one steady note`;
        }
      },
      deviceSelect.value || storedMic() || undefined,
    );
    mic.onEnded = () => {
      stop();
      detail.textContent = 'The microphone was disconnected or switched. Pick one in the Microphone list and click Start mic.';
    };
    startBtn.textContent = 'Stop mic';
    // Diagnostics: what the page actually sees, so problems with a specific setup can be reported.
    const showDiag = () => {
      if (!mic) return;
      diag.textContent =
        `Diagnostics: page audio ${ctx.state} at ${ctx.sampleRate} Hz · mic "${mic.label}" ${mic.settings()} · ` +
        `chunks received ${frames} · level ${Number.isFinite(lastLevelDb) ? Math.round(lastLevelDb) : '—'} dB`;
    };
    showDiag();
    diagTimer = setInterval(showDiag, 500);
    // If no audio arrives, say so instead of sitting silent.
    watchdog = setTimeout(() => {
      if (mic && frames === 0) {
        detail.textContent =
          `No sound is reaching the page from "${mic.label}" (audio ${ctx.state}). ` +
          'Try another microphone in the dropdown, or click Stop mic then Start mic.';
      }
    }, 2000);
    await fillDevices(mic.deviceId);
  };

  const stop = () => {
    if (diagTimer !== null) clearInterval(diagTimer);
    diagTimer = null;
    if (watchdog !== null) clearTimeout(watchdog);
    watchdog = null;
    mic?.stop();
    mic = null;
    startBtn.textContent = 'Start mic';
    noteEl.textContent = '—';
    detail.textContent = 'Mic off.';
    meter.style.width = '0%';
    levelHint.textContent = '';
  };

  const fail = (err: unknown) => {
    stop();
    const msg = err instanceof Error ? err.message : String(err);
    detail.textContent = /denied|NotAllowed/i.test(msg)
      ? 'Microphone blocked. Click the lock icon left of the address bar, set Microphone to Allow, then reload.'
      : `Microphone failed: ${msg}`;
  };

  startBtn.addEventListener('click', () => {
    if (mic) stop();
    else start().catch(fail);
  });

  // A plugged/unplugged headset changes the device list (and often the system default input).
  // Restart a running mic on any change: Chrome can stop delivering mic audio to the page
  // when the output switches (e.g. headphones plugged in on a Mac).
  navigator.mediaDevices?.addEventListener('devicechange', () => {
    if (!mic) return;
    stop();
    start().catch(fail);
  });

  deviceSelect.addEventListener('change', () => {
    storeMic(deviceSelect.value);
    if (!mic) return;
    stop();
    start().catch(fail);
  });
}
