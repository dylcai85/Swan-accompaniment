import { getAudioContext } from '../audio/context';
import { Player, type VoiceStatus } from '../playback/player';
import type { Score } from '../score/types';

const VOICE_TEXT: Record<VoiceStatus, string> = {
  loading: 'Loading piano sound…',
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
      <span class="parts" data-testid="transport-parts"></span>
      <p data-testid="transport-status" role="status">Load a score to play the piano part.</p>
    </section>
  `;
  const q = <T extends HTMLElement>(id: string) => root.querySelector<T>(`[data-testid="${id}"]`)!;
  const playBtn = q<HTMLButtonElement>('transport-play');
  const barInput = q<HTMLInputElement>('transport-bar');
  const goBtn = q<HTMLButtonElement>('transport-go');
  const rateInput = q<HTMLInputElement>('transport-rate');
  const rateLabel = q<HTMLSpanElement>('transport-rate-label');
  const partsEl = q<HTMLSpanElement>('transport-parts');
  const status = q<HTMLParagraphElement>('transport-status');

  let score: Score | null = null;
  let player: Player | null = null;
  /** Single in-flight creation, so rapid clicks while audio starts can't create two players. */
  let creating: Promise<Player | null> | null = null;

  const rate = () => Number(rateInput.value);

  /** Write text only when it changed: the status updates ~40x/s during playback. */
  const setText = (el: HTMLElement, text: string) => {
    if (el.textContent !== text) el.textContent = text;
  };

  const render = () => {
    const bpm = score ? ` (${Math.round(score.nominalBpm * rate())} bpm)` : '';
    setText(rateLabel, `${rate().toFixed(2)}×${bpm}`);
    if (playBtn.disabled !== !score) playBtn.disabled = goBtn.disabled = !score;
    if (!score) {
      setText(status, 'Load a score to play the piano part.');
      return;
    }
    setText(playBtn, player?.state === 'playing' ? 'Pause' : 'Play');
    if (!player) {
      setText(status, 'Ready. Click Play.');
      return;
    }
    const pos = window.__debug.playback;
    const where = pos ? `bar ${pos.bar} beat ${Math.floor(pos.beat)}` : '';
    setText(status, `${VOICE_TEXT[player.voiceStatus]} · ${where}`);
  };

  /** The Player is created on the first Play/Go click: audio may only start from a user gesture. */
  const ensurePlayer = (): Promise<Player | null> => {
    if (!score) return Promise.resolve(null);
    if (player) return Promise.resolve(player);
    const forScore = score;
    creating ??= getAudioContext().then((ctx) => {
      creating = null;
      if (score !== forScore) return null; // a different score was loaded meanwhile
      player = new Player(ctx, forScore);
      partsEl.querySelectorAll<HTMLInputElement>('input').forEach((box, i) => player!.setPartEnabled(i, box.checked));
      player.setRate(rate());
      player.onChange = render;
      return player;
    });
    return creating;
  };

  let starting = false;
  playBtn.addEventListener('click', () => {
    if (starting) return;
    starting = true;
    void ensurePlayer()
      .then(async (p) => {
        if (!p) return;
        if (p.state === 'playing') {
          p.pause();
          return;
        }
        // First Play: wait for the piano samples (or the synth fallback) instead of
        // starting on the synth and switching sound mid-phrase.
        if (p.voiceStatus === 'loading') {
          render();
          await p.ready;
        }
        if (p === player) p.play();
      })
      .finally(() => {
        starting = false;
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

  // One on/off box per accompaniment track, named as in the file.
  partsEl.addEventListener('change', (e) => {
    const box = e.target as HTMLInputElement;
    player?.setPartEnabled(Number(box.dataset.part), box.checked);
  });

  return (next) => {
    player?.pause();
    player = null;
    creating = null;
    score = next;
    if (score) barInput.max = String(score.bars);
    partsEl.replaceChildren(
      ...(score?.accompaniment ?? []).map((p, i) => {
        const label = document.createElement('label');
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.checked = true;
        box.dataset.part = String(i);
        box.dataset.testid = `transport-part-${i}`;
        label.append(box, ` ${p.name}`);
        return label;
      }),
    );
    render();
  };
}
