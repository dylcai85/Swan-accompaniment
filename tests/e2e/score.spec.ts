import { expect, test } from '@playwright/test';

const MINI = 'tests/fixtures/mini-score.mid';
const LOADED = 'Score loaded: mini-score.mid · 6 bars · 3/4 · cello 10 · piano 1 72 · piano 2 19 · nominal 80 bpm';

test('loads a score from the file picker, caches it across reloads, and forgets it', async ({ page }) => {
  await page.goto('./');
  const status = page.getByTestId('score-status');
  await expect(status).toContainText('No score loaded');

  await page.getByTestId('score-input').setInputFiles(MINI);
  await expect(status).toHaveText(LOADED);

  await page.reload();
  await expect(status).toHaveText(LOADED);

  await page.getByTestId('score-forget').click();
  await expect(status).toContainText('No score loaded');
  await page.reload();
  await expect(status).toContainText('No score loaded');
});

test('shows an error for a file that is not MIDI and keeps the cached score', async ({ page }) => {
  await page.goto('./');
  await page.getByTestId('score-input').setInputFiles(MINI);
  await expect(page.getByTestId('score-status')).toHaveText(LOADED);

  await page.getByTestId('score-input').setInputFiles({ name: 'bad.mid', mimeType: 'audio/midi', buffer: Buffer.from('nope') });
  await expect(page.getByTestId('score-status')).toContainText('Could not read bad.mid');

  await page.reload();
  await expect(page.getByTestId('score-status')).toHaveText(LOADED);
});
