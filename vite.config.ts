import { execSync } from 'node:child_process';
import { defineConfig } from 'vitest/config';

// Must match the GitHub Pages path: https://dylcai85.github.io/Swan-accompaniment/
export const BASE = '/Swan-accompaniment/';

function buildId(): string {
  const sha = process.env.GITHUB_SHA;
  if (sha) return sha.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return 'dev';
  }
}

export default defineConfig({
  base: BASE,
  define: {
    __BUILD_ID__: JSON.stringify(buildId()),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  build: {
    // Emit the AudioWorklet as its own file (never a data: URL) so it loads under the Pages base path.
    assetsInlineLimit: (file) => (file.endsWith('.worklet.js') ? false : undefined),
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
  },
});
