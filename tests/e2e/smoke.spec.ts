import { expect, test } from '@playwright/test';

test('production build loads under the Pages base path', async ({ page }) => {
  const errors: string[] = [];
  const failed: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('response', (res) => {
    if (res.status() >= 400) failed.push(`${res.status()} ${res.url()}`);
  });

  await page.goto('./');

  await expect(page.getByTestId('headphones-notice')).toContainText('Headphones required');
  await expect(page.getByTestId('start')).toBeVisible();
  await expect(page.getByTestId('build-stamp')).toHaveText(/^build \S+/);

  // Every script/style was requested under the base path.
  const assetUrls = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLScriptElement | HTMLLinkElement>('script[src], link[href]')].map((el) =>
      el instanceof HTMLScriptElement ? el.src : el.href,
    ),
  );
  expect(assetUrls.length).toBeGreaterThan(0);
  for (const url of assetUrls) expect(new URL(url).pathname).toMatch(/^\/Swan-accompaniment\//);

  await page.getByTestId('start').click();
  await expect(page.getByTestId('status')).toHaveText(/Audio ready · \d+ Hz · base latency/);

  expect(failed).toEqual([]);
  expect(errors).toEqual([]);
});
