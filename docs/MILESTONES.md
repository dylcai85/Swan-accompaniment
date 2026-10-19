# Milestone log

One entry per milestone, newest first. Each entry: what changed, how it was verified, the Dylan test, and what is still unverified. Work is committed directly to `main`.

## M0: Scaffold and deploy (2026-10-19)

**Needs Dylan:** enable GitHub Pages. Step-by-step instructions are in `docs/INPUTS.md`. Until then the Pages steps fail; the tests are unaffected.

**Changed**
- Vite 8 + strict TS, Vitest, Playwright, tsx, Node 22 (`.nvmrc`). Vite `base` = `/Swan-accompaniment/`.
- Page: headphones-required notice, Start button (creates/resumes an interactive `AudioContext` from the click; shows sample rate and base/output latency), build stamp (short SHA + UTC time).
- `npm run check:no-score`: fails if any `.mid/.midi/.mxl/.musicxml/.pdf` (except `tests/fixtures/mini-score.mid`) or anything under `local/` is in the git index, or any such file is in `dist/`.
- `score:inspect` and `eval` are stubs (exit 0; `score:inspect` prints SKIP when `local/swan.mid` is absent). Replaced in M1 and M4/M5.
- `.github/workflows/ci.yml`: full checks on every push (guard, typecheck, unit, build, guard on dist, e2e, score:inspect, eval); on `main`, deploys `dist/` to Pages.

**Dependencies** (devDependencies, exact pins, each ≥2 weeks old)
- `vite` 8.3.2: bundler/dev server.
- `typescript` 5.9.3: strict typecheck (mature 5.x line, not the 7.0 native rewrite).
- `vitest` 5.0.3: unit tests.
- `@playwright/test` 1.56.1: e2e; matches the Chromium preinstalled in cloud sessions.
- `tsx` 4.23.15: runs TS tools in Node.
- `@types/node` 22.20.5: types for tools/configs.
- npm 10.9 (bundled with Node 22) crashes resolving vitest's peer set (arborist `edgesOut` bug); the lockfile was written with npm 11.6.2 and `npm ci` with npm 10 installs it fine.

**Verified** (cloud sandbox, Chromium 141, no mic; real score present for score:inspect)
- All commands green: check:no-score, typecheck, test (2 unit tests), build, check:no-score on dist, test:e2e, score:inspect, eval.
- `dist/index.html` references only `/Swan-accompaniment/assets/...`. The e2e test serves the production build with `vite preview` under that path and asserts: notice, Start and build stamp visible; all assets under the base path; no 4xx; no console errors; Start reports "Audio ready · N Hz · base latency …".
- `score:inspect` with and without `local/swan.mid`: both exit 0, the latter with a clear SKIP message.
- Guard negative tests: a force-staged dummy `x.mid` and a dummy `dist/leak.pdf` each make `check:no-score` exit 1 (neither committed).
- CI green on GitHub Actions for the M0 commits.

**Unverified (no mic/speakers here):** real-device latency values; that the deployed site loads (Pages not enabled yet); browsers other than Chromium.

**Dylan test** (desktop Chrome, after Pages is enabled and the deploy job is green)
- [ ] https://dylcai85.github.io/Swan-accompaniment/ loads and shows the headphones notice.
- [ ] The footer build stamp matches the latest `main` commit's short SHA.
- [ ] Click **Start**; report the sample rate and base/output latency, once with wired headphones plugged in and once without.

## Setup (2026-10-19)

- `.gitignore` (first commit, before anything else), `CLAUDE.md`, `docs/PLAN.md`, `README.md`, `docs/LOCAL_FILES.md`, `docs/INPUTS.md`, `fixtures/real/README.md`.
- PLAN.md facts checked against the real `local/swan.mid` (present): all stated facts match (type 1, 4 tracks, PPQ 256, 6/4 → 1536 ticks/bar, G major, 44 tempo events 50-70 bpm with median 67, cello 113 notes E3-D5 entering bar 2 beat 1 all on the 16th grid, piano 1 919 notes, piano 2 258 notes with 50 off-grid onsets, ~27 bars). Minor notes for M1: duration is 145.4 s (not ~148 s); the cello track has 60 legato overlaps of 2-15 ticks with no simultaneous onsets (clip them to keep the line monophonic); piano 1 has 1 off-grid onset.
