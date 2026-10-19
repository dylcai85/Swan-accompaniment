import './style.css';
import { startAudio, type AudioInfo } from './audio/context';
import { formatBuildStamp } from './buildInfo';
import { mountScorePanel } from './ui/scorePanel';

const ms = (s: number | null): string => (s === null ? 'n/a' : `${Math.round(s * 1000)} ms`);

function describe(info: AudioInfo): string {
  return `Audio ready · ${info.sampleRate} Hz · base latency ${ms(info.baseLatency)} · output latency ${ms(info.outputLatency)}`;
}

function render(root: HTMLElement): void {
  root.innerHTML = `
    <main>
      <h1>Swan accompaniment</h1>
      <p class="notice" data-testid="headphones-notice">
        <strong>Headphones required.</strong> Use wired headphones: speaker sound leaks into the microphone,
        and Bluetooth adds too much delay.
      </p>
      <div id="score-panel"></div>
      <button type="button" id="start" data-testid="start">Start</button>
      <p id="status" data-testid="status" role="status">Not started.</p>
    </main>
    <footer>
      <span data-testid="build-stamp">${formatBuildStamp(__BUILD_ID__, __BUILD_TIME__)}</span>
    </footer>
  `;

  mountScorePanel(root.querySelector<HTMLElement>('#score-panel')!, () => {
    // The score is used from M2 on (playback).
  });

  const button = root.querySelector<HTMLButtonElement>('#start')!;
  const status = root.querySelector<HTMLParagraphElement>('#status')!;
  button.addEventListener('click', () => {
    startAudio()
      .then((info) => {
        status.textContent = describe(info);
      })
      .catch((err: unknown) => {
        status.textContent = `Audio failed to start: ${err instanceof Error ? err.message : String(err)}`;
      });
  });
}

render(document.querySelector<HTMLElement>('#app')!);
