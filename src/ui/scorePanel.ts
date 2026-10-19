import { parseScore, summarizeScore } from '../score/parse';
import { clearScoreFile, loadScoreFile, saveScoreFile } from '../score/store';
import type { Score } from '../score/types';

const NO_SCORE = 'No score loaded. Choose your MIDI file (e.g. swan.mid); it stays in this browser and is never uploaded.';

/** File picker + cached score. Calls onScore with the parsed score, or null when cleared. */
export function mountScorePanel(root: HTMLElement, onScore: (score: Score | null) => void): void {
  root.innerHTML = `
    <section class="score-panel">
      <label>Load score <input type="file" accept=".mid,.midi,audio/midi" data-testid="score-input" /></label>
      <button type="button" data-testid="score-forget">Forget score</button>
      <p data-testid="score-status" role="status">${NO_SCORE}</p>
    </section>
  `;
  const input = root.querySelector<HTMLInputElement>('[data-testid="score-input"]')!;
  const forget = root.querySelector<HTMLButtonElement>('[data-testid="score-forget"]')!;
  const status = root.querySelector<HTMLParagraphElement>('[data-testid="score-status"]')!;

  const show = (name: string, bytes: ArrayBuffer, cached: boolean): boolean => {
    try {
      const score = parseScore(bytes, name);
      const note = cached ? '' : ' (not cached: browser storage unavailable)';
      status.textContent = `Score loaded: ${summarizeScore(score)}${note}`;
      onScore(score);
      return true;
    } catch (err) {
      status.textContent = `Could not read ${name}: ${err instanceof Error ? err.message : String(err)}`;
      onScore(null);
      return false;
    }
  };

  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) return;
    void file.arrayBuffer().then(async (bytes) => {
      // Parse before caching so a bad file never replaces a good one.
      try {
        parseScore(bytes, file.name);
      } catch {
        show(file.name, bytes, true);
        return;
      }
      const cached = await saveScoreFile({ name: file.name, bytes });
      show(file.name, bytes, cached);
      input.value = '';
    });
  });

  forget.addEventListener('click', () => {
    void clearScoreFile().then(() => {
      status.textContent = NO_SCORE;
      onScore(null);
    });
  });

  void loadScoreFile().then((stored) => {
    if (stored) show(stored.name, stored.bytes, true);
  });
}
