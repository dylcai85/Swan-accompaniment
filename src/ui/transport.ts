import { getAudioContext } from '../audio/context';
import { Player, type VoiceStatus } from '../playback/player';
import type { Score } from '../score/types';

const VOICE_TEXT: Record<VoiceStatus, string> = {
  loading: 'Loading piano sound… (simple synth until it is ready)',
  sampler: 'Piano ready',
  'synth-fallback': 'Using simple synth: piano samples failed to load',
};

/** Playback controls. Call the returned function with each newly loaded (or cleared) score. */
export function mountTransport(root: HTMLElement): (score: Score | null) => void {
  root.innerHTML = `
    <section class="transport">
      <button type="button" data-testid="transport-play" disabled>Play</button>
      <label>Bar <input type="number" min="1" value="1" data-testid="transport-bar" /></label>
      <button type="button" data-testid="transport-go" disabled>Go</button>
      <label class="rate">Speed
        <input type="range" min="0.5" max="1.5" step="0.05" value="1" data-testid="transport-rate" />
        <span data-testid="transport-rate-label">1.00×</span>
      </label>
      <label><input type="checkbox" checked data-testid="transport-piano2" /> Piano 2</label>
      <p data-testid="transport-status" role="status">Load a score to play the piano part.</p>
    </section>
  `;
  const q = <T extends HTMLElement>(id: string) => root.querySelector<T>(`[data-testid="${id}"]`)!;
  const playBtn = q<HTMLButtonElement>('transport-play');
  const barInput = q<HTMLInputElement>('transport-bar');
  const goBtn = q<HTMLButtonElement>('transport-go');
  const rateInput = q<HTMLInputElement>('transport-rate');
  const rateLabel = q<HTMLSpanElement>('transport-rate-label');
  const piano2Box = q<HTMLInputElement>('transport-piano2');
  const status = q<HTMLParagraphElement>('transport-status');

  let score: Score | null = null;
  let player: Player | null = null;

  const rate = () => Number(rateInput.value);

  const render = () => {
    const bpm = score ? ` (${Math.round(score.nominalBpm * rate())} bpm)` : '';
    rateLabel.textContent = `${rate().toFixed(2)}×${bpm}`;
    playBtn.disabled = goBtn.disabled = !score;
    if (!score) {
      status.textContent = 'Load a score to play the piano part.';
      return;
    }
    playBtn.textContent = player?.state === 'playing' ? 'Pause' : 'Play';
    if (!player) {
      status.textContent = 'Ready. Click Play.';
      return;
    }
    const pos = window.__debug.playback;
    const where = pos ? `bar ${pos.bar} beat ${Math.floor(pos.beat)}` : '';
    status.textContent = `${VOICE_TEXT[player.voiceStatus]} · ${where}`;
  };

  /** The Player is created on the first Play/Go click: audio may only start from a user gesture. */
  const ensurePlayer = async (): Promise<Player | null> => {
    if (!score) return null;
    if (!player) {
      player = new Player(await getAudioContext(), score);
      player.piano2 = piano2Box.checked;
      player.setRate(rate());
      player.onChange = render;
    }
    return player;
  };

  playBtn.addEventListener('click', () => {
    void ensurePlayer().then((p) => {
      if (!p) return;
      if (p.state === 'playing') p.pause();
      else p.play();
      render();
    });
  });

  goBtn.addEventListener('click', () => {
    void ensurePlayer().then((p) => p?.seekBar(Number(barInput.value)));
  });

  rateInput.addEventListener('input', () => {
    player?.setRate(rate());
    render();
  });

  piano2Box.addEventListener('change', () => {
    if (player) player.piano2 = piano2Box.checked;
  });

  return (next) => {
    player?.pause();
    player = null;
    score = next;
    if (score) barInput.max = String(score.bars);
    render();
  };
}
