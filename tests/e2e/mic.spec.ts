import { expect, test } from '@playwright/test';

// Runs in the "fake-mic" project: Chromium hears fixtures/synthetic/fake-mic.wav as the microphone
// (A3 sine 1.5 s, silence 1 s, D4 sawtooth 1.5 s, silence 1 s, looped).

interface Reading {
  t: number;
  name: string;
  cents: number;
  voiced: boolean;
  levelDb: number;
}

test('the pitch display follows the fake microphone', async ({ page }) => {
  await page.goto('./');
  await page.getByTestId('mic-start').click();
  await expect(page.getByTestId('mic-start')).toHaveText('Stop mic');
  // The worklet was loaded from the production build under the Pages base path.
  const workletUrl = (await page.evaluate(() => window.__debug.workletUrl))!;
  expect(new URL(workletUrl).pathname).toMatch(/^\/Swan-accompaniment\/assets\/capture\.worklet-.*\.js$/);
  expect((await page.request.get(workletUrl)).status()).toBe(200);

  // Collect readings for 6 s (more than one loop of the file).
  const readings = (await page.evaluate(async () => {
    const out: unknown[] = [];
    let last = -1;
    const end = performance.now() + 6000;
    while (performance.now() < end) {
      const p = window.__debug.pitch;
      if (p && p.t !== last) {
        out.push(p);
        last = p.t;
      }
      await new Promise((r) => setTimeout(r, 10));
    }
    return out;
  })) as Reading[];

  expect(readings.length).toBeGreaterThan(150);
  const a3 = readings.filter((r) => r.voiced && r.name === 'A3');
  const d4 = readings.filter((r) => r.voiced && r.name === 'D4');
  const unvoiced = readings.filter((r) => !r.voiced);
  const other = readings.filter((r) => r.voiced && r.name !== 'A3' && r.name !== 'D4');
  expect(a3.length).toBeGreaterThan(30);
  expect(d4.length).toBeGreaterThan(30);
  expect(unvoiced.length).toBeGreaterThan(20);
  expect(other.length).toBeLessThan(readings.length * 0.03);
  // Steady readings (two same-note readings before them) are within 15 cents; the first frame or
  // two of a note can be off while the analysis window still straddles the silence before it.
  const steady = readings.filter(
    (r, i) => r.voiced && i >= 2 && readings[i - 1]!.name === r.name && readings[i - 2]!.name === r.name,
  );
  expect(steady.length).toBeGreaterThan(60);
  for (const r of steady) expect(Math.abs(r.cents)).toBeLessThan(15);
  const close = [...a3, ...d4].filter((r) => Math.abs(r.cents) < 15);
  expect(close.length / (a3.length + d4.length)).toBeGreaterThan(0.95);
  // The level meter moves: loud during tones, near silence in the gaps.
  expect(Math.max(...readings.map((r) => r.levelDb))).toBeGreaterThan(-20);
  expect(Math.min(...readings.map((r) => r.levelDb))).toBeLessThan(-60);

  await expect(page.getByTestId('mic-latency')).toContainText('analysis window');
  await page.getByTestId('mic-start').click();
  await expect(page.getByTestId('mic-start')).toHaveText('Start mic');
});

test('falls back to another mic mode when the raw stream is pure silence (MacBook + headphones)', async ({ page }) => {
  // Simulate Chrome on a Mac with wired headphones: raw capture delivers exact zeros,
  // capture with echo cancellation delivers real audio.
  await page.addInitScript(() => {
    const real = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (c?: MediaStreamConstraints) => {
      const audio = c?.audio as MediaTrackConstraints | undefined;
      if (audio && audio.echoCancellation === true) return real(c);
      const ctx = new AudioContext();
      const silent = ctx.createMediaStreamDestination();
      const stream = await real(c);
      const out = new MediaStream(silent.stream.getAudioTracks());
      // Keep the real track's label so the UI looks the same.
      Object.defineProperty(out.getAudioTracks()[0]!, 'label', { value: stream.getAudioTracks()[0]!.label });
      stream.getTracks().forEach((t) => t.stop());
      return out;
    };
  });
  await page.goto('./');
  await page.getByTestId('mic-start').click();
  // The switch is quiet: once on, the button stays on "Stop mic" throughout.
  await expect(page.getByTestId('mic-start')).toHaveText('Stop mic');
  const t0 = Date.now();
  while (Date.now() - t0 < 2000) {
    expect(await page.getByTestId('mic-start').textContent()).toBe('Stop mic');
    await page.waitForTimeout(100);
  }
  await expect(page.getByTestId('mic-diagnostics')).toContainText('mode echo-cancel', { timeout: 10_000 });
  await expect.poll(async () => (await page.evaluate(() => window.__debug.pitch))?.name, { timeout: 10_000 }).toMatch(/^(A3|D4)$/);

  // The working mode is remembered for this setup: after a reload it starts there directly.
  await page.reload();
  await page.getByTestId('mic-start').click();
  await expect(page.getByTestId('mic-diagnostics')).toContainText('mode echo-cancel', { timeout: 1500 });
});

test('the last note stays in place (greyed) during rests', async ({ page }) => {
  await page.goto('./');
  await page.getByTestId('mic-start').click();
  const note = page.getByTestId('mic-note');
  await expect(note).toHaveText(/^(A3|D4) /, { timeout: 10_000 });
  // Wait for a silent gap in the fake mic file, then check the note is kept but greyed.
  await expect(note).toHaveClass(/stale/, { timeout: 10_000 });
  await expect(note).toHaveText(/^(A3|D4) /);
  const box = await note.boundingBox();
  await expect(note).not.toHaveClass(/stale/, { timeout: 10_000 });
  expect(await note.boundingBox()).toEqual(box);
});
