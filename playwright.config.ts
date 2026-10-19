import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const BASE = '/Swan-accompaniment/';

export default defineConfig({
  testDir: 'tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}${BASE}`,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: /mic\.spec\.ts/ },
    {
      // Chromium hears a generated WAV as the microphone (CLAUDE.md: fake-mic e2e).
      name: 'fake-mic',
      testMatch: /mic\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        permissions: ['microphone'],
        launchOptions: {
          args: [
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
            '--use-file-for-fake-audio-capture=fixtures/synthetic/fake-mic.wav',
          ],
        },
      },
    },
  ],
  // Test the production build under the Pages base path, not the dev server.
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}${BASE}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
