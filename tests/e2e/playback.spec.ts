import { expect, test, type Page } from '@playwright/test';

const MINI = 'tests/fixtures/mini-score.mid';

interface Playback {
  state: string;
  tick: number;
  bar: number;
  rate: number;
  handedOff: number;
  voice: string;
}

async function loadMini(page: Page): Promise<void> {
  await page.goto('./');
  await page.getByTestId('score-input').setInputFiles(MINI);
  await expect(page.getByTestId('score-status')).toContainText('Score loaded: mini-score.mid');
}

const playback = (page: Page) => page.evaluate(() => window.__debug.playback as Playback | undefined);

test('offline render: note onsets in the audio match the scheduler through a rate change', async ({ page }) => {
  await loadMini(page);
  const result = await page.evaluate(() =>
    window.__debug.renderOffline!({ seconds: 10, piano2: false, rateChanges: [{ at: 5, rate: 0.75 }] }),
  );
  const { expected, detected } = result as { expected: number[]; detected: number[] };
  expect(expected.length).toBeGreaterThan(40);
  expect(detected).toHaveLength(expected.length);
  const errors = expected.map((t, i) => Math.abs(detected[i]! - t));
  expect(Math.max(...errors)).toBeLessThan(0.01);
  // The rate change shows up in the audio: sixteenths are further apart after it.
  const gap = (i: number) => detected[i + 1]! - detected[i]!;
  const before = detected.findIndex((t) => t > 2);
  const after = detected.findIndex((t) => t > 7);
  expect(gap(after) / gap(before)).toBeCloseTo(1 / 0.75, 1);
});

test('transport: play, change speed, pause, go to bar, with the synth fallback', async ({ page }) => {
  await loadMini(page);
  const status = page.getByTestId('transport-status');
  await expect(status).toHaveText('Ready. Click Play.');

  await page.getByTestId('transport-play').click();
  await expect(page.getByTestId('transport-play')).toHaveText('Pause');
  await expect.poll(async () => (await playback(page))?.tick ?? 0).toBeGreaterThan(500);
  await expect.poll(async () => (await playback(page))?.handedOff ?? 0).toBeGreaterThan(0);

  // The sandbox can't reach the sample CDN, so the player must fall back and say so.
  await expect(status).toContainText(/Using simple synth|Piano ready/, { timeout: 35_000 });

  await page.getByTestId('transport-rate').fill('0.6');
  await expect(page.getByTestId('transport-rate-label')).toHaveText('0.60× (48 bpm)');
  await expect.poll(async () => (await playback(page))?.rate).toBe(0.6);

  // Human-length click (press held 150 ms) while the status updates during playback.
  await page.getByTestId('transport-play').click({ delay: 150 });
  await expect(page.getByTestId('transport-play')).toHaveText('Play');
  const paused = (await playback(page))!;
  expect(paused.state).toBe('paused');
  await page.waitForTimeout(300);
  expect((await playback(page))!.tick).toBe(paused.tick);

  await page.getByTestId('transport-bar').fill('4');
  await page.getByTestId('transport-go').click();
  await expect.poll(async () => (await playback(page))?.bar).toBe(4);
  await expect(status).toContainText('bar 4 beat 1');
});
